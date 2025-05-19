import EastIcon from "@mui/icons-material/East";
import NorthEastIcon from "@mui/icons-material/NorthEast";
import SouthEastIcon from "@mui/icons-material/SouthEast";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import Chip from "@mui/joy/Chip";
import { PredictionEnum } from "@zysk/ts-rest";

export const PredictionLabels = {
  [PredictionEnum.WillGrow]: "will grow",
  [PredictionEnum.LikelyGrow]: "likely grow",
  [PredictionEnum.StayTheSame]: "stay the same",
  [PredictionEnum.LikelyFall]: "likely will fall",
  [PredictionEnum.WillFall]: "will fall",
} as const;

const getColor = (prediction: PredictionEnum) => {
  switch (prediction) {
    case PredictionEnum.WillGrow:
      return "success";
    case PredictionEnum.LikelyGrow:
      return "success";
    case PredictionEnum.StayTheSame:
      return "primary";
    case PredictionEnum.LikelyFall:
      return "danger";
    case PredictionEnum.WillFall:
      return "danger";
  }
};

const getIcon = (prediction: PredictionEnum) => {
  switch (prediction) {
    case PredictionEnum.WillGrow:
      return <TrendingUpIcon fontSize="small" />;
    case PredictionEnum.LikelyGrow:
      return <NorthEastIcon fontSize="small" />;
    case PredictionEnum.StayTheSame:
      return <EastIcon fontSize="small" />;
    case PredictionEnum.LikelyFall:
      return <SouthEastIcon fontSize="small" />;
    case PredictionEnum.WillFall:
      return <TrendingDownIcon fontSize="small" />;
  }
};

export function PredictionBadge({
  prediction,
}: {
  prediction: PredictionEnum;
}) {
  return (
    <Chip
      color={getColor(prediction)}
      variant="soft"
      startDecorator={getIcon(prediction)}
      size="md"
    >
      {PredictionLabels[prediction]}
    </Chip>
  );
}
