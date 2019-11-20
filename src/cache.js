import Web3 from 'web3'
import dotenv from 'dotenv/config'
import { pRateLimit } from 'p-ratelimit'
import fs from 'fs'
import path from 'path'

import { sitemapIntro, sitemapWrite, sitemapFinalize } from './sitemap.js'
import Dett from './lib/dett.js'
import LoomProvider from './loom.js'
import ShortURL from './lib/shortURL.js'
import db from '../models'

const { Article, CommentEvent, Height } = db

async function initalize() {
  await Article.sync()
  await CommentEvent.sync()
  await Height.sync()
}
initalize()

let dett = null
let loomWeb3 = null
let contractOwner = '0x2089f8ef830f4414143686ed0dfac4f5bc0ace04'

const rpcRateLimiter = pRateLimit({
  interval: 2500,
  rate: 1,
  concurrency: 1,
})

const outputPath = 'dist'
const sitemapPath = path.join(outputPath, 'sitemap.xml')

const addShortLink = async (tx) => {
  const shortLink = ShortURL.encode(dett.cacheweb3.utils.hexToNumber(tx.substr(0,10))).padStart(6,'0')
  const hexId = dett.cacheweb3.utils.padLeft(dett.cacheweb3.utils.toHex(shortLink), 64)

  const receipt = await dett.BBSCache.methods.link(tx, hexId).send({ from: contractOwner })
  if (receipt.status === true) {
    console.log('#Add ShortLink : '+tx+' '+shortLink)
    return hexId
  }

  return null
}

const syncLinks = async () => {
  const articals = await Article.findAll({ where: { short_link: null } })
  articals.forEach(async (artical) => {
    console.log(artical)
    const link = await dett.BBSCache.methods.links(artical.txid).call({ from: contractOwner })
    artical.short_link = loomWeb3.utils.hexToUtf8(link)
    artical.save()
  })

  console.log('#Sync Done')
}

const saveSitemap = async () => {
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

const cacheArticles = async () => {
  await syncLinks()

  const previousHeight = (await Height.findOrCreate({ where: { tag: 'articles' } }))[0].dataValues.last_block_height
  let fromBlock = previousHeight ? previousHeight : dett.fromBlock
  let events = []

  for (let start = +fromBlock ; start < dett.currentHeight ; start+=(dett.step+1)) {
    events = await dett.mergedArticles(events, start, start+dett.step)
  }

  // ############################################
  // #### Generate Cache && Short link

  for (const [i, event] of events.entries()) {
    const tx = event.transactionHash
    const blockNumber = event.blockNumber.toString()
    let link = await dett.BBSCache.methods.links(tx).call({ from: contractOwner })

    // generate short links
    if (!+(link))
      if (updateAccess)
        link = await addShortLink(tx, blockNumber)

    await Article.findOrCreate({
      where: {
        block_number: blockNumber,
        txid: tx,
        short_link: loomWeb3.utils.hexToUtf8(link),
      }
    })
  }

  await Height.update({ last_block_height: dett.currentHeight - dett.step }, { where: { tag: 'articles' } })
}


export const cache = async (updateAccess) => {
  // ############################################
  // #### init Dett
  
  const privateKeyString = process.env.LOOM_PRIVATEKEY

  const loomProvider =  new LoomProvider({
    chainId: 'default',
    writeUrl: 'https://loom-basechain.xxxx.nctu.me/rpc',
    readUrl: 'https://loom-basechain.xxxx.nctu.me/query',
    libraryName: 'web3.js',
    web3Api: Web3,
  })
  loomProvider.setNetworkOnly(privateKeyString)

  dett = new Dett()
  await dett.init(loomProvider)
  loomWeb3 = dett.loomProvider.library

  await cacheArticles()
  await saveSitemap()
}

const main = async () => {
  await cache(false)
  process.exit(0)
}

if (!module.parent.parent)
  main()

// feature && issue
// 2.log
// 3.master env set cache network
// 4.compress porblem
