import { resolve } from "@zysk/services";
import Redis from "ioredis";
import { keyBy } from "lodash";

export async function memoizeScrapperUrls(
  urls: string[],
  format: "md" | "html",
  callback: (urls: string[]) => Promise<
    {
      url: string;
      content?: string;
      error?: Error;
    }[]
  >,
) {
  const redis = resolve(Redis);
  const cachedUrls = keyBy(
    (
      await Promise.allSettled(
        urls.map((url) => redis.get(`scrapper:urls:format:${format}:${url}`)),
      )
    )
      .map((r, index) => {
        if (r.status === "fulfilled" && r.value) {
          return {
            url: urls[index],
            content: r.value,
          } as {
            url: string;
            content: string;
            error?: Error;
          };
        }
        return null;
      })
      .filter(Boolean),
    "url",
  );

  const newUrls = urls.filter((url) => !(url in cachedUrls));

  const newUrlsContent = await callback(newUrls);

  const contentToCache = newUrlsContent
    .filter((r) => !r.error && r.content)
    .map((r) => ({
      url: r.url,
      content: r.content!,
    }));

  await Promise.allSettled(
    contentToCache.map((r) =>
      redis.set(
        `scrapper:urls:format:${format}:${r.url}`,
        r.content,
        "EX",
        "5 minutes",
      ),
    ),
  );

  return [...Object.values(cachedUrls), ...newUrlsContent];
}
