import { marshal, MarshalUnion } from "@zensors/sheriff";
import {
	IRouterHandler,
	IRouterMatcher,
	NextFunction,
	Request,
	RequestHandler,
	Response,
	Router as ExpressRouter
} from "express";

export type UnknownRequest = Request<unknown, unknown, unknown, unknown>;

type ExpressUsable = IRouterHandler<any> & IRouterMatcher<any>;

class Consumable {
	private consumed: boolean;

	public constructor() {
		this.consumed = false;
	}

	protected checkConsumed() {
		if (this.consumed) {
			throw new Error("This Router has already been consumed.");
		}
	}

	protected consume() {
		this.checkConsumed();
		this.consumed = true;
	}
}

export class Router<S extends UnknownRequest = UnknownRequest, T extends UnknownRequest = S> extends Consumable {
	private router: ExpressRouter;

	public constructor(router?: ExpressRouter) {
		super();
		this.router = router ?? ExpressRouter();
	}


	public use<R extends UnknownRequest>(subpath: string, usable: Router<T, R>): Router<S, T>;
	public use<R extends UnknownRequest>(usable: Router<T, R>): Router<S, T>;
	public use(subpath: string, usable: ExpressUsable): Router<S, T>;
	public use(usable: ExpressUsable): Router<S, T>;
	public use(first: unknown, second?: unknown): Router<S, T> {
		this.consume();
		if (first instanceof Router) {
			first = first.toExpress();
		}
		if (second instanceof Router) {
			second = second.toExpress();
		}
		this.router.use(first as any, second as any); // unavoidable cast
		return new Router(this.router);
	}

	public then<T1 extends UnknownRequest>(fn: (req: T) => T1 | Promise<T1>): Router<S, T1> {
		this.consume();

		this.router.use(async (req, _res, next) => {
			await fn(req as T);
			next();
		});

		return new Router(this.router);
	}

	public get(path: string): LeafRouter<T> {
		this.checkConsumed();
		return new LeafRouter(this.router, "get", path);
	}

	public post(path: string): LeafRouter<T> {
		this.checkConsumed();
		return new LeafRouter(this.router, "post", path);
	}

	public put(path: string): LeafRouter<T> {
		this.checkConsumed();
		return new LeafRouter(this.router, "put", path);
	}

	public delete(path: string): LeafRouter<T> {
		this.checkConsumed();
		return new LeafRouter(this.router, "delete", path);
	}

	public toExpress(): ExpressRouter {
		this.consume();
		return this.router;
	}
}

type Method = "get" | "post" | "put" | "delete";

class LeafRouter<T extends UnknownRequest> extends Consumable {
	private router: ExpressRouter;
	private method: Method;
	private path: string;
	private handlers: RequestHandler[];

	public constructor(
		router: ExpressRouter,
		method: Method,
		path: string,
		handlers?: RequestHandler[]
	) {
		super();
		this.router = router;
		this.method = method;
		this.path = path;
		this.handlers = handlers ?? [];
	}

	public then<S extends UnknownRequest>(fn: (req: T) => S | Promise<S>): LeafRouter<S> {
		this.consume();
		return new LeafRouter<S>(
			this.router,
			this.method,
			this.path,
			this.handlers.concat([
				async (req, _res, next) => {
					await fn(req as T);
					next();
				}
			])
		);
	}

	public return<S>(fn: (req: T) => S | Promise<S>): void {
		this.consume();
		this.router[this.method](
			this.path,
			...this.handlers,
			async (req, res: Response<S>) => {
				let reply = await fn(req as T); // unavoidable cast
				res.send(reply);
			}
		);
	}

	public finish<S>(fn: (req: T, res: Response<S>) => void): void {
		this.consume();
		this.router[this.method](
			this.path,
			...this.handlers,
			(req, res) => fn(req as T, res)
		);
	}
}

export const marshalParams =
	<T>(description: MarshalUnion<T>) =>
	<R extends UnknownRequest>(req: R) => {
		marshal(req.body, description);
		return req as R & Request<T, unknown, unknown, unknown>;
	};

export const marshalQuery =
	<T>(description: MarshalUnion<T>) =>
	<R extends UnknownRequest>(req: R) => {
		marshal(req.body, description);
		return req as R & Request<unknown, unknown, unknown, T>;
	};

export const marshalBody =
	<T>(description: MarshalUnion<T>) =>
	<R extends UnknownRequest>(req: R) => {
		marshal(req.body, description);
		return req as R & Request<unknown, unknown, T, unknown>;
	};


