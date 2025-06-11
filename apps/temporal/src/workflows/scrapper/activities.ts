import { activityInfo, ApplicationFailure } from "@temporalio/activity";
import { PageLoadError, scrapeUrl } from "@zysk/scrapper";
import { getLogger } from "@zysk/services";

export async function scrapeUrlViaBrowser(url: string) {
  const logger = getLogger();
  try {
    const result = await scrapeUrl({
      url,
    });
    return result;
  } catch (ex) {
    logger.error(
      {
        error: (ex as Error).message,
      },
      "Error scraping url",
    );

    if (
      ex instanceof PageLoadError &&
      (ex.status === 401 || ex.status === 403 || ex.status === 408)
    ) {
      const attempt = activityInfo().attempt;
      throw ApplicationFailure.create({
        type: "RequestTimeout",
        nonRetryable: attempt >= 3,
        message: `Error scraping URL ${url} with status ${ex.status}: ${ex.message}`,
        nextRetryDelay: `${Math.pow(2, attempt - 1) * 60}s`,
      });
    }
    throw ApplicationFailure.create({
      type: "ScapeError",
      nonRetryable: true,
      message: (ex as Error).message,
      cause: ex as Error,
    });
  }
}
