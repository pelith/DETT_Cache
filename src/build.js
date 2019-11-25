import dotenv from 'dotenv/config'
import Web3 from 'web3'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'

import { sitemapIntro, sitemapWrite, sitemapFinalize } from './sitemap.js'
import Dett from './lib/dett.js'
import LoomProvider from './loom.js'
import { parseText, parseUser, htmlEntities, formatPttDateTime } from './lib/utils.js'
import db from '../models'

const { Article, CommentEvent, Height } = db

async function initalize() {
  await Article.sync()
  await CommentEvent.sync()
  await Height.sync()
}
initalize()

let dett = null

const outputPath = 'dist'
const sitemapPath = path.join(outputPath, 'sitemap.xml')
const outputJsonPath = path.join(outputPath, 'output.json')
const outputCachePath = path.join(outputPath, 's')
const outputPageCachePath = path.join(outputPath, 'p')
const outputCommentCachePath = path.join(outputPath, 'c')

const ghPath = 'gh-pages'
const ghCacheTemplatePath = path.join(ghPath, 'cache.html')

let jsonData = {}

function checksum(str, algorithm, encoding) {
  return  crypto
          .createHash(algorithm || 'sha256')
          .update(str, 'utf8')
          .digest(encoding || 'hex');
}

const loadLocalStorage = () => {
  if (!(fs.existsSync(outputPath) && fs.lstatSync(outputPath).isDirectory()))
    fs.mkdirSync(outputPath)
  if (fs.existsSync(outputJsonPath) && fs.lstatSync(outputJsonPath).isFile())
    jsonData = JSON.parse(fs.readFileSync(outputJsonPath))

  if (!jsonData.hasOwnProperty('checksum'))
    jsonData.checksum = ""
}

const saveLocalStorage = () => {
  const rawData = JSON.stringify(jsonData, null, 4)
  fs.writeFileSync(outputJsonPath, rawData, 'utf8');
}

const buildSitemap = async () => {
  const prefix = 'https://dett.cc'
  const f = fs.openSync(sitemapPath, 'w')
  sitemapIntro(f)
  {['/', '/about'].forEach(slug => {
    sitemapWrite(f, prefix + slug)
  })}
  fs.writeSync(f, '  <!-- Static pages below are generated; do not edit -->\n')
  const articals = await Article.findAll()
  Object.values(articals).forEach(artical => {
    sitemapWrite(f, prefix + '/s/' + artical.short_link)
  })
  sitemapFinalize(f)
}

const buildPageCache = async () => {
  // if exist create output folder
  if (!(fs.existsSync(outputPageCachePath) && fs.lstatSync(outputPageCachePath).isDirectory()))
    fs.mkdirSync(outputPageCachePath)

  const articals = await Article.findAll()
  const pageTx = articals.map(artical => {
    return artical.txid
  })

  const pageSize = Math.ceil(pageTx.length / 20)
  for (let page = 0 ; page < pageSize ; page++) {
    const cacheData = pageTx.slice(page*20, page*20+19)
    const filePath = path.join(outputPageCachePath, pageSize-page + '.json')
    fs.writeFileSync(filePath, JSON.stringify(cacheData), 'utf8')
  }
}

const buildCommentCache = async () => {
  // if exist create output folder
  if (!(fs.existsSync(outputCommentCachePath) && fs.lstatSync(outputCommentCachePath).isDirectory()))
    fs.mkdirSync(outputCommentCachePath)

  const articals = await Article.findAll()

  
  const builder = articals.map(async (artical) => {
    const cacheEvents = await CommentEvent.findAll({ where: { article_txid: artical.txid } })
    const cacheData = await cacheEvents.map(async (cacheEvent) => {
      const [comment] = await Promise.all([
        dett.getComment(JSON.parse(cacheEvent.event)),
      ])

      return [comment]
    })

    let comments = []

    await cacheData.reduce(async (n,p) => {
      await n
      const _p = await p
      let temp = JSON.parse(JSON.stringify(_p[0]))
      temp.transaction.nonce = null
      temp.block = []
      comments = comments.concat(temp)
    }, Promise.resolve())

    const filePath = path.join(outputCommentCachePath, artical.txid + '.json')
    fs.writeFileSync(filePath, JSON.stringify(comments), 'utf8')
  })

  await Promise.all(builder)
}

const generateShortLinkCachePage = async (tx, shortLink) => {
  const article = await dett.getArticle(tx)
  // NOTE THE POTENTIAL XSS HERE!!
  const titleEscaped = htmlEntities(article.title)
  const url = 'https://dett.cc/' + 's/' + shortLink
  // is trimming out title from desc the intended behavior??
  const description = htmlEntities(parseText(article.content, 160)).replace(/\n|\r/g, ' ')

  // TODO: rendering HTML here is more realistic
  const contentEscaped = htmlEntities(article.content)

  const cacheMeta = { 'dett:title': titleEscaped,
                      'dett:url': url,
                      'dett:desc': htmlEntities(description),
                      'dett:post:author': htmlEntities(parseUser(article.transaction.from, article.authorMeta)),
                      'dett:post:time-iso': new Date(article.block.timestamp).toISOString(),
                      'dett:post:time': formatPttDateTime(article.block.timestamp),
                      'dett:post:title': titleEscaped,
                      'dett:post:content': contentEscaped,
                      'dett:tx:content': tx }
  const reg = new RegExp(Object.keys(cacheMeta).join("|"),"gi")
  const template = fs.readFileSync(ghCacheTemplatePath, 'utf-8')

  const cacheFile = template.replace(reg, (matched) => {
    return cacheMeta[matched]
  })

  const filePath = path.join(outputCachePath, shortLink + '.html')
  await fs.writeFileSync(filePath, cacheFile, 'utf8')
}

export const build = async () => {
  loadLocalStorage()

  const loomProvider =  new LoomProvider({
    chainId: 'default',
    writeUrl: `${process.env.RPC_URL}/rpc`,
    readUrl: `${process.env.RPC_URL}/query`,
    libraryName: 'web3.js',
    web3Api: Web3,
  })
  loomProvider.setNetworkOnly()

  dett = new Dett()
  await dett.init(loomProvider)

  // if cache output folder not exist create it
  if (!(fs.existsSync(outputCachePath) && fs.lstatSync(outputCachePath).isDirectory()))
    fs.mkdirSync(outputCachePath)

  if (!(fs.existsSync(ghCacheTemplatePath) && fs.lstatSync(ghCacheTemplatePath).isFile()))
    throw "template file is not exist"

  const _checksum = checksum(fs.readFileSync(ghCacheTemplatePath))
  const shouldUpdate = _checksum !== jsonData.checksum

  if (shouldUpdate)
    jsonData.checksum = _checksum

  const articles = await Article.findAll()
  for (const article of articles) {
    const shortLinkPath = path.join(outputCachePath, article.txid+'.html')

    if (shouldUpdate || !(fs.existsSync(shortLinkPath) && fs.lstatSync(shortLinkPath).isFile()))
      await generateShortLinkCachePage(article.txid, article.short_link)
  }

  saveLocalStorage()
  await buildSitemap()
  await buildPageCache()
  await buildCommentCache()

  console.log('#Generate Cache Page Done.')
}

const main = async () => {
  try {
    await build()
    process.exit(0)
  }
  catch (e) {
    console.log(e)
    process.exit(1)
  }
}

if (!module.parent.parent)
  main()