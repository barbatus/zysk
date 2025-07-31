import axios from "axios";
import { injectable } from "inversify";

interface Filter {
  segment: string;
  isFirst: boolean;
  level: number;
}

interface SitemapFilters {
  sitemaps?: Filter[];
  links?: Omit<Filter, "level">[];
}

@injectable()
export class CrawlerService {
  async sitemapLinks(domain: string, filters: SitemapFilters) {
    const links = await this.sitemapLinksViaBotasaurus(domain, filters);
    return links;
  }

  async sitemapLinksViaBotasaurus(domain: string, filters: SitemapFilters) {
    const links = await axios.post<string[]>(
      "http://localhost:8000/api/sitemaps/links",
      {
        domain,
        ...filters,
      },
    );
    return links.data;
  }
}
