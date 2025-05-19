import CloseIcon from "@mui/icons-material/Close";
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CardOverflow,
  Chip,
  IconButton,
  Stack,
  Switch,
  Typography,
} from "@mui/joy";
import { type SxProps } from "@mui/system";
import { type PredictionEnum } from "@zysk/ts-rest";
import { format } from "date-fns";
import Link from "next/link";

import { PredictionBadge } from "./prediction-badge";

export function TickerPredictionCard({
  symbol,
  title,
  lastPrediction,
  sx,
}: {
  symbol: string;
  title?: string;
  lastPrediction?: {
    createdAt: Date;
    prediction: PredictionEnum;
    insights: {
      insight: string;
      impact: "positive" | "negative" | "mixed";
      reasoning: string;
      url?: string;
    }[];
  };
  sx?: SxProps;
}) {
  return (
    <Card sx={sx}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          mb: 1,
        }}
      >
        <Stack spacing={0.5}>
          <Stack direction="row" spacing={1}>
            <Typography level="title-lg">{symbol}</Typography>
            {title ? (
              <Chip color="neutral" size="sm" variant="outlined">
                {title}
              </Chip>
            ) : null}
          </Stack>
          {lastPrediction ? (
            <Typography level="body-sm" color="neutral">
              Last analysis: {format(lastPrediction.createdAt, "MMM d, yyyy")}
            </Typography>
          ) : null}
        </Stack>
        <IconButton variant="plain" color="neutral" size="sm">
          <CloseIcon />
        </IconButton>
      </Box>
      <CardContent>
        {lastPrediction ? (
          <>
            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
              <Typography level="body-sm">Next week prediction:</Typography>
              <PredictionBadge prediction={lastPrediction.prediction} />
            </Stack>
            <Stack spacing={0.5}>
              {lastPrediction.insights.slice(0, 3).map(({ insight }) => (
                <Typography
                  key={insight}
                  level="body-sm"
                  color="neutral"
                  fontWeight="md"
                >
                  • {insight}
                </Typography>
              ))}
            </Stack>
          </>
        ) : null}
      </CardContent>
      <CardOverflow sx={{ borderTop: "1px solid", borderColor: "divider" }}>
        <CardActions sx={{ justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Switch size="lg" />
            <Typography level="body-sm" fontWeight="md">
              Subscribe
            </Typography>
          </Box>
          <Button
            component={Link}
            href={`/digest/${symbol}`}
            variant="plain"
            color="neutral"
            size="sm"
          >
            View Details
          </Button>
        </CardActions>
      </CardOverflow>
    </Card>
  );
}
