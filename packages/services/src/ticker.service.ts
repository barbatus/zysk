import { injectable } from "inversify";

@injectable()
export class TickerService {
  async getSupportedTickers() {
    return ["AAPL"];
  }
}
