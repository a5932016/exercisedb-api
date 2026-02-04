import { OpenAPIHono } from '@hono/zod-openapi'
import { Scalar } from '@scalar/hono-api-reference'
import fs from 'fs/promises'
import path from 'path'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { Home } from './pages/home'
import { Routes } from '#common/types'
import type { HTTPException } from 'hono/http-exception'
import { cors } from 'hono/cors'
export class App {
  private app: OpenAPIHono
  constructor(routes: Routes[]) {
    this.app = new OpenAPIHono()
    this.initializeApp(routes)
  }
  private async initializeApp(routes: Routes[]) {
    try {
      this.initializeGlobalMiddleware()
      this.initializeRoutes(routes)
      this.initializeSwaggerUI()
      this.initializeRouteFallback()
      this.initializeErrorHandler()
    } catch (error) {
      console.error('Failed to initialize application:', error)
      throw new Error('Failed to initialize application')
    }
  }

  private initializeRoutes(routes: Routes[]) {
    // Serve static media files from the local `media` folder at `/media/*`
    this.app.get('/media/*', async (c) => {
      try {
        // Parse URL safely (works for relative URLs) and extract the media-relative path
        const base = c.req.header('host')
          ? `${c.req.header('x-forwarded-proto') || 'http'}://${c.req.header('host')}`
          : 'http://localhost'
        const url = new URL(c.req.url, base)
        const relPath = decodeURIComponent(url.pathname.replace(/^\/media\//, ''))
        // Prevent path traversal
        if (relPath.includes('..')) return c.text('Not found', 404)

        // Resolve paths to handle Windows backslashes and drive letters correctly
        const mediaRoot = path.resolve(process.cwd(), 'media')
        const filePath = path.resolve(mediaRoot, relPath)
        // Ensure requested file is inside mediaRoot
        if (!(filePath === mediaRoot || filePath.startsWith(mediaRoot + path.sep))) return c.text('Not found', 404)

        const data = await fs.readFile(filePath)
        // Convert Node Buffer to Uint8Array to satisfy Web `Body` types
        const ext = path.extname(filePath).toLowerCase()
        const mimeMap: Record<string, string> = {
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.gif': 'image/gif',
          '.webp': 'image/webp',
          '.svg': 'image/svg+xml',
          '.mp4': 'video/mp4',
          '.webm': 'video/webm',
          '.json': 'application/json'
        }
        const contentType = mimeMap[ext] || 'application/octet-stream'
        const bodyData = new Uint8Array((data as Buffer).buffer, (data as Buffer).byteOffset, (data as Buffer).byteLength)
        // Cast to `any` to satisfy the handler's accepted body types across different runtime typings
        return c.body(bodyData as unknown as any, 200, { 'Content-Type': contentType })
      } catch (err) {
        return c.text('Not found', 404)
      }
    })

    routes.forEach((route) => {
      route.initRoutes()
      this.app.route('/api/v1', route.controller)
    })
    this.app.route('/', Home)
  }

  private initializeGlobalMiddleware() {
    this.app.use(
      cors({
        origin: '*',
        allowMethods: ['GET', 'OPTIONS']
      })
    )

    this.app.use(logger())
    this.app.use(prettyJSON())
    this.app.use(async (c, next) => {
      const start = Date.now()
      await next()
      const end = Date.now()
      c.res.headers.set('X-Response-Time', `${end - start}ms`)
    })

    // this.app.use(authMiddleware)
  }

  private initializeSwaggerUI(): void {
    // OpenAPI documentation for v1
    this.app.doc31('/swagger', (c) => {
      const { protocol: urlProtocol, hostname, port } = new URL(c.req.url)
      const protocol = c.req.header('x-forwarded-proto') ? `${c.req.header('x-forwarded-proto')}:` : urlProtocol

      return {
        openapi: '3.1.0',
        info: {
          version: '1.0.0',
          title: 'ExerciseDB API - v1 (Open Source)',
          description: `**ExerciseDB API v1** is a fully open-source and developer-friendly fitness exercise database featuring over 1,500 structured exercises with **GIF-based visual media**. It includes detailed metadata like target muscles, equipment, and body parts, designed for fast integration into fitness apps, personal trainer platforms, and health tools.

**📝 NOTE**: This version is public, free to use, and includes both the **code and dataset metadata** — making it perfect for personal projects, prototypes, learning, and community-driven apps.

🔗 Useful Links:
- 💬 Need full v1 Dataset access: [Download Now](https://dub.sh/v1_plans)
- 🚀 Explore our new v2 dataset: [v2.exercisedb.dev](https://v2.exercisedb.dev)
- 🌐 Official Website: [exercisedb.dev](https://exercisedb.dev)`
        },
        servers: [
          {
            url: `${protocol}//${hostname}${port ? `:${port}` : ''}`,
            description:
              'v1 Dataset (Open Source)\n• Public & open license\n• Code and metadata available on GitHub\n• GIF-based media\n• Ideal for demos, personal apps, and learning\n• chat support for full dataset access'
          }
        ]
      }
    })

    // API Documentation UI
    this.app.get(
      '/docs',
      Scalar({
        pageTitle: 'ExerciseDB API - v1 (Open Source)',
        theme: 'kepler',
        isEditable: false,
        layout: 'modern',
        darkMode: true,
        hideDownloadButton: true,
        hideDarkModeToggle: true,
        url: '/swagger',
        favicon: 'https://cdn.exercisedb.dev/exercisedb/favicon.ico',
        defaultOpenAllTags: true,
        hideClientButton: true,
        metaData: {
          applicationName: 'ExerciseDB API - v1',
          author: 'Ascend API',
          creator: 'Ascend API',
          publisher: 'Ascend API',
          ogType: 'website',
          robots: 'index follow',
          description: `**ExerciseDB API v1** is a fully open-source exercise dataset offering 1,300+ exercises with rich metadata and GIF visualizations. Built for speed and ease of use, it's ideal for personal projects, prototypes, and education.

🔗 Useful Links:
- 💬 Chat with us for full GIF access: [Telegram](https://t.me/exercisedb)
- 🚀 Explore our new v2 dataset: [v2.exercisedb.dev](https://v2.exercisedb.dev)
- 🌐 Official Website: [exercisedb.dev](https://exercisedb.dev)`
        }
      })
    )
  }

  private initializeRouteFallback() {
    this.app.notFound((c) => {
      return c.json(
        {
          success: false,
          message: 'route not found!!. check docs at https://v1.exercisedb.dev/docs'
        },
        404
      )
    })
  }
  private initializeErrorHandler() {
    this.app.onError((err, c) => {
      const error = err as HTTPException
      console.log(error)
      return c.json({ success: false, message: error.message }, error.status || 500)
    })
  }
  public getApp() {
    return this.app
  }
}
