import CloseIcon from "@mui/icons-material/Close";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import CardActions from "@mui/joy/CardActions";
import CardContent from "@mui/joy/CardContent";
import CardOverflow from "@mui/joy/CardOverflow";
import Chip from "@mui/joy/Chip";
import IconButton from "@mui/joy/IconButton";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Switch from "@mui/joy/Switch";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import Popover, { type PopoverProps } from "@mui/material/Popover";
import {
  createTheme as createMuiTheme,
  ThemeProvider as MuiThemeProvider,
} from "@mui/material/styles";
import { type SxProps } from "@mui/system";
import {
  DIMENSION_NAME_QUOTE,
  METRIC_NAME_TICKER_LAST_WEEK_PERFORMANCE,
  METRIC_NAME_TICKER_PREV_DAY_PERFORMANCE,
} from "@zysk/cube";
import { type TickerSentimentPrediction } from "@zysk/ts-rest";
import { format } from "date-fns";
import { Info, TrendingDown, TrendingUp } from "lucide-react";
import PopupState, { bindPopover, bindTrigger } from "material-ui-popup-state";
import Link from "next/link";

import { type MetricsRow } from "#/api/metrics";

import { SentimentBadge } from "./sentiment-badge";

const muiTheme = createMuiTheme({});

function MuiPopover(props: PopoverProps) {
  return (
    <MuiThemeProvider theme={muiTheme}>
      <Popover {...props} />
    </MuiThemeProvider>
  );
}

export function TickerCardSkeleton() {
  return (
    <Card
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        maxWidth: 400,
      }}
    >
      <CardContent sx={{ flex: 1 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            mb: 2,
          }}
        >
          <Skeleton
            variant="rectangular"
            width={100}
            height={24}
            sx={{ borderRadius: "sm" }}
          />
          <Skeleton variant="circular" width={24} height={24} />
        </Box>

        <Box sx={{ mb: 2 }}>
          <Skeleton
            variant="rectangular"
            width={200}
            height={16}
            sx={{ borderRadius: "sm" }}
          />
        </Box>

        <Stack direction="column" spacing={0.5} sx={{ mb: 2 }}>
          <Skeleton
            variant="text"
            width="100%"
            height={16}
            sx={{ borderRadius: "sm" }}
          />
          <Skeleton
            variant="text"
            width="85%"
            height={16}
            sx={{ borderRadius: "sm" }}
          />
          <Skeleton
            variant="text"
            width="95%"
            height={16}
            sx={{ borderRadius: "sm" }}
          />
          <Skeleton
            variant="text"
            width="85%"
            height={16}
            sx={{ borderRadius: "sm" }}
          />
          <Skeleton
            variant="text"
            width="100%"
            height={16}
            sx={{ borderRadius: "sm" }}
          />
        </Stack>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            pt: 2,
            borderTop: "1px solid",
            borderColor: "divider",
            mt: "auto",
          }}
        >
          <Skeleton
            variant="rectangular"
            width={72}
            height={20}
            sx={{ borderRadius: "sm" }}
          />
          <Skeleton
            variant="rectangular"
            width={100}
            height={20}
            sx={{ borderRadius: "sm" }}
          />
        </Box>
      </CardContent>
    </Card>
  );
}

export function TickerStateCard({
  symbol,
  title,
  prediction,
  sx,
  currentQuote,
}: {
  symbol: string;
  title?: string;
  prediction?: TickerSentimentPrediction;
  sx?: SxProps;
  currentQuote?: MetricsRow;
}) {
  return (
    <Card sx={{ gap: 0.5, ...sx }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <Stack spacing={0.5}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography level="title-lg">{symbol}</Typography>
            {currentQuote ? (
              <Typography level="title-md" fontWeight="lg">
                ${currentQuote[DIMENSION_NAME_QUOTE]}
              </Typography>
            ) : null}
            {title ? (
              <Chip color="neutral" size="sm" variant="outlined">
                {title}
              </Chip>
            ) : null}
          </Stack>
          {currentQuote ? (
            <Stack direction="row" spacing={1} alignItems="center">
              {currentQuote[METRIC_NAME_TICKER_PREV_DAY_PERFORMANCE] ? (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    color:
                      Number(
                        currentQuote[METRIC_NAME_TICKER_PREV_DAY_PERFORMANCE],
                      ) >= 0
                        ? "success.500"
                        : "danger.500",
                  }}
                >
                  {Number(
                    currentQuote[METRIC_NAME_TICKER_PREV_DAY_PERFORMANCE],
                  ) >= 0 ? (
                    <TrendingUp size={14} />
                  ) : (
                    <TrendingDown size={14} />
                  )}
                  <Typography
                    level="body-sm"
                    fontWeight="lg"
                    sx={{
                      color: "inherit",
                    }}
                  >
                    1D:
                    {Number(
                      currentQuote[METRIC_NAME_TICKER_LAST_WEEK_PERFORMANCE],
                    ).toFixed(1)}
                    %
                  </Typography>
                </Box>
              ) : null}
              {currentQuote[METRIC_NAME_TICKER_LAST_WEEK_PERFORMANCE] ? (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    color:
                      Number(
                        currentQuote[METRIC_NAME_TICKER_LAST_WEEK_PERFORMANCE],
                      ) >= 0
                        ? "success.500"
                        : "danger.500",
                  }}
                >
                  {Number(
                    currentQuote[METRIC_NAME_TICKER_LAST_WEEK_PERFORMANCE],
                  ) >= 0 ? (
                    <TrendingUp size={14} />
                  ) : (
                    <TrendingDown size={14} />
                  )}
                  <Typography
                    level="body-sm"
                    fontWeight="lg"
                    sx={{
                      color: "inherit",
                    }}
                  >
                    1W:
                    {Number(
                      currentQuote[METRIC_NAME_TICKER_LAST_WEEK_PERFORMANCE],
                    ).toFixed(1)}
                    %
                  </Typography>
                </Box>
              ) : null}
            </Stack>
          ) : null}
        </Stack>
        <IconButton variant="plain" color="neutral" size="sm">
          <CloseIcon />
        </IconButton>
      </Box>
      <CardContent>
        {prediction ? (
          <>
            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
              <Typography level="body-sm" fontWeight="md">
                Short-term outlook:
              </Typography>
              <SentimentBadge sentiment={prediction.sentiment} />
            </Stack>
            <Stack spacing={0.5}>
              <Tooltip
                title={prediction.reasoning}
                size="lg"
                sx={{
                  maxWidth: 400,
                  padding: 2,
                  fontWeight: "sm",
                }}
                variant="outlined"
                placement="right"
                arrow
              >
                <Typography
                  level="body-md"
                  fontWeight={200}
                  color="neutral"
                  sx={{
                    display: "-webkit-box",
                    WebkitLineClamp: 5,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    cursor: "pointer",
                  }}
                >
                  {prediction.reasoning}
                </Typography>
              </Tooltip>
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                justifyContent="space-between"
              >
                {prediction.insights.length >= 1 && (
                  <PopupState variant="popover" popupId="demo-popup-popover">
                    {(popupState) => (
                      <div>
                        <Button
                          variant="plain"
                          color="neutral"
                          size="sm"
                          startDecorator={<Info size={12} />}
                          sx={{
                            minHeight: "auto",
                            width: "fit-content",
                            fontWeight: "md",
                          }}
                          {...bindTrigger(popupState)}
                        >
                          Show insights
                        </Button>
                        <MuiPopover
                          {...bindPopover(popupState)}
                          anchorOrigin={{
                            vertical: "bottom",
                            horizontal: "left",
                          }}
                        >
                          <Box
                            sx={{
                              p: 2,
                              width: 400,
                              maxHeight: 400,
                              overflow: "auto",
                            }}
                          >
                            <Stack spacing={1}>
                              {prediction.insights.map((insight) => (
                                <Typography
                                  key={insight.insight}
                                  level="body-sm"
                                  fontWeight={300}
                                  sx={{
                                    color: "var(--joy-palette-text-secondary)",
                                  }}
                                >
                                  • {insight.insight}
                                </Typography>
                              ))}
                            </Stack>
                          </Box>
                        </MuiPopover>
                      </div>
                    )}
                  </PopupState>
                )}
                <Typography
                  level="body-xs"
                  sx={{
                    color: "var(--joy-palette-neutral-500)",
                    fontWeight: "sm",
                    fontSize: "0.75rem",
                  }}
                >
                  Generated: {format(prediction.createdAt, "MMM d, yyyy")}
                </Typography>
              </Stack>
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
