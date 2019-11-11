import fs from 'fs'
import path from 'path'
import rimraf from 'rimraf'
import NetlifyAPI from 'netlify'

import git from 'simple-git'
import gitP from 'simple-git/promise'

import rsync from 'rsyncwrapper'
import dotenv from 'dotenv/config'
import cloudflarePurgeCache from 'cloudflare-purge-cache'

import {cache} from './cache.js'
import {build} from './build.js'

const outputPath = 'dist'
const outputJsonPath = path.join(outputPath, 'output.json')
const outputCachePath = path.join(outputPath, 's')
const outputPageCachePath = path.join(outputPath, 'p')

const netlifyPath = 'netlify'
const netlifyCachePath = path.join(netlifyPath, 's')
const netlifyPageCachePath = path.join(netlifyPath, 'p')

const ghPath = 'gh-pages'
const ghCachePath = path.join(ghPath, 's')
const ghPageCachePath = path.join(ghPath, 'p')

const clone = async () => {
  //delete gh-pages folder
  if (fs.existsSync('gh-pages') && fs.lstatSync('gh-pages').isDirectory())
    await rimraf.sync('gh-pages')

  await gitP().silent(true)
  .clone('git@github.com:Gilg4mesh/LOOM_BBS.git', 'gh-pages', ['--single-branch','--branch','gh-pages'])
  .then(() => console.log('#Clone Done.'))
  .catch((err) => console.error('failed: ', err))
}

const rsyncCopyDir = (src, dest) => {
  return new Promise((resolve, reject) => {
    rsync({
      src: path.join(src, '/'),
      dest: dest,
      recursive: true,
    }, (error, stdout, stderr, cmd) => {
      if (error) {
        // failed
        console.log(error.message)
        reject(error.message)
      } else {
        // success
        resolve()
      }
    })
  })
}


const server = async () => {
  console.log("server runing...")

  const hrstart = process.hrtime()

  // ############################################
  // #### Clone dett gh-page branch

  if (fs.existsSync(ghPath) && fs.lstatSync(ghPath).isDirectory()) {
    await gitP(__dirname + '/../gh-pages/').fetch()
    const status = await gitP(__dirname + '/../gh-pages/').status()
    if (status.behind || status.ahead)
      await clone()
  }
  else
    await clone()

  // ############################################
  // #### Generate Cache Page and ShortLink

  await cache(true)
  await build()

  // ############################################
  // #### Commit & push
  /*
  await rsyncCopyDir(outputCachePath, ghCachePath)
  await rsyncCopyDir(outputPageCachePath, ghPageCachePath)

  await gitP(__dirname + '/../gh-pages/').add('.')
  await gitP(__dirname + '/../gh-pages/').commit("Add cache page")

  const status = await gitP(__dirname + '/../gh-pages/').status()
  if (status.behind || status.ahead) {
    await gitP(__dirname + '/../gh-pages/').push(['-u', 'origin', 'gh-pages'])
          .then(console.log('#Push Done.'))

    // await cloudflarePurgeCache(process.env.CF_EMAIL, process.env.CF_KEY, process.env.CF_ZONE_ID)
    //       .then(console.log('#Cloudflare purge cache Done.'))
  }
  */

  // ############################################
  // #### Update Netlify

  if (!fs.existsSync(netlifyPath)) fs.mkdirSync(netlifyPath)

  await rsyncCopyDir(ghPath, netlifyPath)
  await rsyncCopyDir(outputCachePath, netlifyCachePath)
  await rsyncCopyDir(outputPageCachePath, netlifyPageCachePath)

  const client = new NetlifyAPI(process.env.NETLIFY_KEY)
  await client.deploy(process.env.NETLIFY_SITE_ID, netlifyPath).then(console.log('#Deployed to Netlify.')) // limit: 3 deploys/minute


  const hrend = process.hrtime(hrstart)
  console.info(`Execution time (hr): %ds %dms`, hrend[0], hrend[1] / 1000000)
}

const main = async () => {
  try {
    await server(true)

    const intervalObj = setInterval(async () => {
      await server(true)
    }, 0.5*60*1000)
  }
  catch (e) {
    console.log(e)
    process.exit(1)
  }
}

main()

process.once('SIGINT',() => {
    process.exit(0);
})