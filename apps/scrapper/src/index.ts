import { scrapeUrls } from "@zysk/scrapper";

async function main() {
  const content = await scrapeUrls({
    urls: [`https://www.google.com/recaptcha/api2/demo`],
  });

  console.log(content);
}

void main();
