from src.scrape_news import scrape_md

if __name__ == "__main__":
    urls = [
        "https://www.marketwatch.com/story/these-defense-stocks-offer-the-best-growth-prospects-as-the-israel-iran-conflict-fuels-new-interest-in-the-sector-3f9a5821"
        # "https://seekingalpha.com/article/4774233-nvidia-the-dip-were-backing-with-conviction-rating-upgrade",
        # "https://seekingalpha.com/article/4774210-microsoft-playing-defense-during-the-global-trade-war",
        # "https://seekingalpha.com/article/4774228-microsoft-still-stable-but-now-cheaper",
        # "https://seekingalpha.com/article/4774172-broadcom-the-trade-wars-next-big-loser",
    ]
    for url in urls:
        scrape_md(
            {"link": url}
        )

