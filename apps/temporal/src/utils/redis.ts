import { resolve } from "@zysk/services";
import Redis from "ioredis";

export async function retrieveScrapperUrls(
  urls: string[],
  format: "md" | "html",
) {
  const redis = resolve(Redis);
  return (
    await Promise.allSettled(
      urls.map((url) => redis.get(`scrapper:urls:format:${format}:${url}`)),
    )
  ).map((r, index) => {
    if (r.status === "fulfilled" && r.value) {
      return {
        url: urls[index],
        content: r.value,
      } as {
        url: string;
        content: string;
      };
    }
    return null;
  });
}

export async function memoizeScrapperUrls(
  result: {
    url: string;
    content: string;
  }[],
  format: "md" | "html",
) {
  const redis = resolve(Redis);
  await Promise.allSettled(
    result.map((r) =>
      redis.set(
        `scrapper:urls:format:${format}:${r.url}`,
        r.content,
        "EX",
        "5 minutes",
      ),
    ),
  );
}
