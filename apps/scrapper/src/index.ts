import { scrapeUrl } from "@zysk/scrapper";

async function main() {
  const content = await scrapeUrl({
    url: `https://www.google.com/recaptcha/api2/demo`,
  });

  console.log(content);
}

void main();
