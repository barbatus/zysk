from src.scrape_news import scrape_md

if __name__ == "__main__":
    urls = [
        "https://www.investors.com/market-trend/stock-market-today/dow-jones-sp500-nasdaq-circle-meta-palantir-nvda-tsla/"
        # "https://seekingalpha.com/article/4774233-nvidia-the-dip-were-backing-with-conviction-rating-upgrade",
        # "https://seekingalpha.com/article/4774210-microsoft-playing-defense-during-the-global-trade-war",
        # "https://seekingalpha.com/article/4774228-microsoft-still-stable-but-now-cheaper",
        # "https://seekingalpha.com/article/4774172-broadcom-the-trade-wars-next-big-loser",
    ]
    for url in urls:
        scrape_md({"link": url, "log_md": True})
