import EastIcon from "@mui/icons-material/East";
import NorthEastIcon from "@mui/icons-material/NorthEast";
import SouthEastIcon from "@mui/icons-material/SouthEast";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import Chip from "@mui/joy/Chip";
import { SentimentEnum } from "@zysk/ts-rest";

export const SentimentLabels = {
  [SentimentEnum.Bullish]: "bullish",
  [SentimentEnum.LikelyBullish]: "likely bullish",
  [SentimentEnum.Neutral]: "neutral",
  [SentimentEnum.LikelyBearish]: "likely bearish",
  [SentimentEnum.Bearish]: "bearish",
} as const;

const getSentimentColor = (sentiment: SentimentEnum) => {
  switch (sentiment) {
    case SentimentEnum.Bullish:
      return "success";
    case SentimentEnum.LikelyBullish:
      return "success";
    case SentimentEnum.Neutral:
      return "primary";
    case SentimentEnum.LikelyBearish:
      return "danger";
    case SentimentEnum.Bearish:
      return "danger";
  }
};

const getSentimentIcon = (sentiment: SentimentEnum) => {
  switch (sentiment) {
    case SentimentEnum.Bullish:
      return <TrendingUpIcon fontSize="small" />;
    case SentimentEnum.LikelyBullish:
      return <NorthEastIcon fontSize="small" />;
    case SentimentEnum.Neutral:
      return <EastIcon fontSize="small" />;
    case SentimentEnum.LikelyBearish:
      return <SouthEastIcon fontSize="small" />;
    case SentimentEnum.Bearish:
      return <TrendingDownIcon fontSize="small" />;
  }
};

export function SentimentBadge({ sentiment }: { sentiment: SentimentEnum }) {
  return (
    <Chip
      color={getSentimentColor(sentiment)}
      variant="soft"
      startDecorator={getSentimentIcon(sentiment)}
      size="md"
    >
      {SentimentLabels[sentiment]}
    </Chip>
  );
}
