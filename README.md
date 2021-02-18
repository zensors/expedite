<p align="center">
    <h1 align="center">Expedite</h1>
</p>
<p align="center">
    Build webservers faster and more type-safely
</p>
<p align="center">
    <img src="https://badge.buildkite.com/97fbd19f7d1f1159d7aa24fcf97ba2beb27c42279716bdc192.svg?branch=master">
    <a href="https://npmjs.com/package/@zensors/expedite">
        <img alt="npm" src="https://img.shields.io/npm/v/@zensors/expedite">
    </a>
    <img alt="npm type definitions" src="https://img.shields.io/npm/types/@zensors/expedite">
</p>

-----

## Get Started

Expedite can be installed with `npm` or `yarn`:

```bash
npm install --save @zensors/expedite
yarn add @zensors/expedite
```

## Example

```ts
// blog.ts
import { Router, marshalParams, marshalBody } from "@zensors/expedite";
import { M } from "@zensors/sheriff";

import { authenticateAdmin, getPost, createPost, generateSlug } from "...";

const BlogRouter = new Router();

BlogRouter.get("/:slug")
	.then(marshalParams(M.obj({ slug: M.str })))
	.return(async (req) => {
		return await getPost(req.slug); // because we marshalled the params, TS knows that req.slug is of type string
	});

const BlogRouterWithAuth = BlogRouter.then(authenticateAdmin);
// If authenticateAdmin throws an error if the requester isn't an admin, then all endpoints chained off of
// BlogRouterWithAuth are only accessible by admins

BlogRouterWithAuth.post("/")
	.then(marshalBody(M.obj({ title: M.str, author: M.str, date: M.num, content: M.str })))
	.finish(async (req, res) => {
		// Because we marshalled the body, we can use req.body without having everything typed as any
		const slug = generateSlug(req.body.title);
		await createPost(slug, req.body);
		res.redirect(`/${slug}`);
	});

export default BlogRouterWithAuth;
```

```ts
// index.ts
import { Router } from "@zensors/expedite";
import { MarshalError } from "@zensors/sheriff";
import express from "express";
import bp from "body-parser";

import BlogRouter from "./blog";

// Contstruct the main router
const mainRouter =
	new Router()
		.use("/blog", BlogRouter);

// Initialize the app

const app = express();
app.use(bp.json()); // Expedite doesn't parse the body for you; use body-parser for that
app.use(mainRouter.toExpress());

app.use((error: any, req, res, next) => {
	// You are expected to handle your own errors

	if (error instanceof MarshalError) { // Add a "bad request" handler for marshal errors
		res.status(400).json({ message: error.message });
	} else {
		res.status(500).json({ message: "Internal server error" });
	}
});

app.listen(8080);
```
