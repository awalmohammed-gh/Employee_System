import { createContext } from "react";

/**
 * Where page-level loaders render.
 * "screen"  – no app shell yet (auth checks, first load): cover the whole viewport.
 * "content" – inside the Admin/Employee layout: fill only the page (outlet) area so the
 *             sidebar and top bar stay visible while a page loads.
 */
export const LoaderScopeContext = createContext("screen");
