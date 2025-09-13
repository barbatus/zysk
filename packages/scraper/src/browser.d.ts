import { type Browser, type BrowserContext, type Page } from "puppeteer";
export declare class PageLoadError extends Error {
    status: number;
    constructor(status: number, message: string);
}
export declare function isBrowserHealthy(browser: Browser): Promise<boolean>;
export declare function newBrowserPages(params: {
    pages: number;
    context: BrowserContext;
}): Promise<{
    pages: Page[];
}>;
export declare function scrapeUrls(params: {
    urls: string[];
    waitFor?: number;
    timeout?: number;
    convertToMd?: boolean;
    useProxy?: boolean;
    onPoll?: () => void;
}): Promise<{
    url: string;
    content?: string;
    error?: Error;
}[]>;
//# sourceMappingURL=browser.d.ts.map