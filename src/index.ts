import { marshal, MarshalUnion } from "@zensors/sheriff";
import {
	IRouterHandler,
	IRouterMatcher,
	Request,
	RequestHandler,
	Response,
	Router as ExpressRouter
} from "express";

/**
 * An Express request whose params, query, body, and response type are all unknown.
 */
export type UnknownRequest = Request<unknown, unknown, unknown, unknown>;

/**
 * The type of the allowable arguments to the `use` method of an `ExpressRouter`.
 */
type ExpressUsable = IRouterHandler<any> & IRouterMatcher<any>;

/**
 * A base class for an object that can be consumed (i.e., used in a specified
 * manner only once).
 */
class Consumable {
	/**
	 * Whether or not this instance has been consumed.
	 */
	private consumed: boolean;

	public constructor() {
		this.consumed = false;
	}

	/**
	 * Throws an error if this instance has been consumed.
	 */
	protected checkConsumed() {
		if (this.consumed) {
			throw new Error("This Router has already been consumed.");
		}
	}

	/**
	 * Throws an error if this instance has been consumed, and otherwise consumes it.
	 */
	protected consume() {
		this.checkConsumed();
		this.consumed = true;
	}
}

/**
 * A `Router` is the primary way of operating Expedite, and provides methods for adding middlewares, adding endpoints,
 * and delegating to other `Router`s.
 */
export class Router<S extends UnknownRequest = UnknownRequest, T extends UnknownRequest = S> extends Consumable {
	/**
	 * The underlying `ExpressRouter` of this instance.
	 */
	private router: ExpressRouter;

	/**
	 * Constructs a new `Router`, either using the given `ExpressRouter` or by instantiating a new one.
	 *
	 * @param router - the `ExpressRouter` to use
	 */
	public constructor(router?: ExpressRouter) {
		super();
		this.router = router ?? ExpressRouter();
	}


	/**
	 * Delegates all requests to the given subpath to the given router.  Consumes this router and returns a new one.
	 *
	 * @param subpath - the subpath
	 * @param usable - the router to which to delegate requests
	 * @returns a new `Router`
	 */
	public use<R extends UnknownRequest>(subpath: string, router: Router<T, R>): Router<S, T>;

	/**
	 * Delegates all incoming requests to the given router.  Consumes this router and returns a new one.
	 *
	 * @param usable - the router to which to delegate requests
	 * @returns a new `Router`
	 */
	public use<R extends UnknownRequest>(router: Router<T, R>): Router<S, T>;

	/**
	 * Delegates all requests to the given subpath to the given middleware.  Consumes this router and returns a new one.
	 *
	 * @param subpath - the subpath
	 * @param usable - the middleware to which to delegate requests
	 * @returns a new `Router`
	 */
	public use(subpath: string, usable: ExpressUsable): Router<S, T>;

	/**
	 * Delegates all incoming requests to the given middleware.  Consumes this router and returns a new one.
	 *
	 * @param usable - the middleware to which to delegate requests
	 * @returns a new `Router`
	 */
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


	/**
	 * Adds the given function to the request chain for all incoming requests, additionally narrowing the request type.
	 * Consumes this router and returns a new one.
	 *
	 * @param fn - the function to add to the request chain
	 * @returns a new `Router`
	 */
	public then<T1 extends UnknownRequest>(fn: (req: T) => T1 | Promise<T1>): Router<S, T1> {
		this.consume();

		this.router.use(async (req, _res, next) => {
			try {
				await fn(req as T);
				next();
			} catch (e) {
				next(e);
			}
		});

		return new Router(this.router);
	}

	/**
	 * Adds a new GET endpoint to this router.  Requests matching this endpoint will be delegated to the returned
	 * `Router`, and all non-matching requests will continue on this one.  Requires that this `Router` isn't consumed,
	 * but doesn't consume it; further functions can still be added to the request chain.
	 *
	 * @param path - the path at which to add a GET endpoint
	 * @returns a new `LeafRouter` for handling paths at the given endpoint
	 */
	public get(path: string): LeafRouter<T> {
		this.checkConsumed();
		return new LeafRouter(this.router, "get", path);
	}

	/**
	 * Adds a new POST endpoint to this router.  Requests matching this endpoint will be delegated to the returned
	 * `Router`, and all non-matching requests will continue on this one.  Requires that this `Router` isn't consumed,
	 * but doesn't consume it; further functions can still be added to the request chain.
	 *
	 * @param path - the path at which to add a POST endpoint
	 * @returns a new `LeafRouter` for handling paths at the given endpoint
	 */
	public post(path: string): LeafRouter<T> {
		this.checkConsumed();
		return new LeafRouter(this.router, "post", path);
	}

	/**
	 * Adds a new PUT endpoint to this router.  Requests matching this endpoint will be delegated to the returned
	 * `Router`, and all non-matching requests will continue on this one.  Requires that this `Router` isn't consumed,
	 * but doesn't consume it; further functions can still be added to the request chain.
	 *
	 * @param path - the path at which to add a PUT endpoint
	 * @returns a new `LeafRouter` for handling paths at the given endpoint
	 */
	public put(path: string): LeafRouter<T> {
		this.checkConsumed();
		return new LeafRouter(this.router, "put", path);
	}

	/**
	 * Adds a new DELETE endpoint to this router.  Requests matching this endpoint will be delegated to the returned
	 * `Router`, and all non-matching requests will continue on this one.  Requires that this `Router` isn't consumed,
	 * but doesn't consume it; further functions can still be added to the request chain.
	 *
	 * @param path - the path at which to add a DELETE endpoint
	 * @returns a new `LeafRouter` for handling paths at the given endpoint
	 */
	public delete(path: string): LeafRouter<T> {
		this.checkConsumed();
		return new LeafRouter(this.router, "delete", path);
	}

	/**
	 * Consumes this `Router` and converts it into an `ExpressRouter`.
	 *
	 * @returns an `ExpressRouter` built from this `Router`
	 */
	public toExpress(): ExpressRouter {
		this.consume();
		return this.router;
	}
}

/**
 * A type consisting of valid HTTP methods, as strings.
 */
type Method = "get" | "post" | "put" | "delete";

/**
 * A `LeafRouter` represents a router that corresponds to a single endpoint.
 */
class LeafRouter<T extends UnknownRequest> extends Consumable {
	/**
	 * The underlying `ExpressRouter` of this instance.
	 */
	private router: ExpressRouter;

	/**
	 * The HTTP method for this endpoint.
	 */
	private method: Method;

	/**
	 * The path for this endpoint.
	 */
	private path: string;

	/**
	 * The function chain for this endpoint.
	 */
	private handlers: RequestHandler[];

	/**
	 * Constructs a new `LeafRouter` that handles requests to the given path with the given method, backed by the given
	 * `ExpressHandler`.  It will use the provided function chain or an empty function chain if none is given.
	 *
	 * You will probably never need to call this constructor directly; the `get`, `post`, `put`, and `delete` methods
	 * of `Router` will do it for you.
	 *
	 * @param router - the `ExpressRouter` to use
	 * @param method - the method of the endpoint
	 * @param path - the path of the endpoint
	 * @param handlers - the request chain to use
	 */
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

	/**
	 * Adds a function to the request chain for this endpoint.  Consumes this `LeafRouter` and returns a new one.
	 *
	 * @param fn - the function to add
	 */
	public then<S extends UnknownRequest>(fn: (req: T) => S | Promise<S>): LeafRouter<S> {
		this.consume();
		return new LeafRouter<S>(
			this.router,
			this.method,
			this.path,
			this.handlers.concat([
				async (req, _res, next) => {
					try {
						await fn(req as T);
						next();
					} catch (e) {
						next(e);
					}
				}
			])
		);
	}

	/**
	 * Finishes the request chain by sending the result of the function to the client as JSON.  Non-JSON endpoints and
	 * endpoints that do anything other than just return JSON data (e.g., setting cookies) should use `finish` instead.
	 *
	 * @param fn - the function whose result will be returned to the client
	 */
	public return<S>(fn: (req: T) => S | Promise<S>): void {
		this.consume();
		this.router[this.method](
			this.path,
			...this.handlers,
			async (req, res: Response<S>, next) => {
				try {
					let reply = await fn(req as T); // unavoidable cast
					res.send(reply);
				} catch (e) {
					next(e);
				}
			}
		);
	}

	/**
	 * Finishes the request chain with a custom finishing function.  The provided function is responsible for returning
	 * a response to the client.  If you just want to return JSON without any other operations (e.g. setting cookies),
	 * `return` is preferred.
	 *
	 * @param fn - the function that will finish the request and send the response to the client
	 */
	public finish<S>(fn: (req: T, res: Response<S>) => void | Promise<void>): void {
		this.consume();
		this.router[this.method](
			this.path,
			...this.handlers,
			async (req, res, next) => {
				try {
					return await fn(req as T, res)
				} catch (e) {
					next(e);
				}
			}
		);
	}
}

/**
 * Checks that the request parameters (`req.params`) match the specified marshaller and narrows the request type
 * accordingly.
 *
 * @param description - the marshaller to use with the request parameters
 * @throws if the request parameters do not match the marshaller
 */
export const marshalParams =
	<T>(description: MarshalUnion<T>) =>
	<R extends UnknownRequest>(req: R) => {
		marshal(req.params, description);
		return req as R & Request<T, unknown, unknown, unknown>;
	};

/**
 * Checks that the request query parameters (`req.query`) match the specified marshaller and narrows the request type
 * accordingly.
 *
 * @param description - the marshaller to use with the request query parameters
 * @throws if the request query parameters do not match the marshaller
 */
export const marshalQuery =
	<T>(description: MarshalUnion<T>) =>
	<R extends UnknownRequest>(req: R) => {
		marshal(req.query, description);
		return req as R & Request<unknown, unknown, unknown, T>;
	};

/**
 * Checks that the request body (`req.body`) matches the specified marshaller and narrows the request type accordingly.
 *
 * @param description - the marshaller to use with the request body
 * @throws if the request body does not match the marshaller
 */
export const marshalBody =
	<T>(description: MarshalUnion<T>) =>
	<R extends UnknownRequest>(req: R) => {
		marshal(req.body, description);
		return req as R & Request<unknown, unknown, T, unknown>;
	};


