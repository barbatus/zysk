import { TrendingDown, TrendingFlat, TrendingUp } from "@mui/icons-material";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Popover, { type PopoverProps } from "@mui/material/Popover";
import {
  createTheme as createMuiTheme,
  ThemeProvider as MuiThemeProvider,
} from "@mui/material/styles";
import { type TickerSentimentPrediction } from "@zysk/ts-rest";
import { Info } from "lucide-react";
import PopupState, { bindPopover, bindTrigger } from "material-ui-popup-state";

const muiTheme = createMuiTheme({});

function MuiPopover(props: PopoverProps) {
  return (
    <MuiThemeProvider theme={muiTheme}>
      <Popover {...props} />
    </MuiThemeProvider>
  );
}

function InsightItem({
  confidence,
  compact,
  description,
  impact,
}: {
  confidence: number;
  description: string;
  compact?: boolean;
  impact: "positive" | "negative" | "neutral" | "mixed";
}) {
  const opacity = 0.6 + confidence * 0.4;

  const getIcon = () => {
    const iconProps = {
      fontSize: "small" as const,
      sx: { opacity },
    };

    switch (impact) {
      case "positive":
        return <TrendingUp color="success" {...iconProps} />;
      case "negative":
        return <TrendingDown color="error" {...iconProps} />;
      case "neutral":
        return <TrendingFlat color="secondary" {...iconProps} />;
      case "mixed":
        return <TrendingFlat color="secondary" {...iconProps} />;
    }
  };

  if (compact) {
    return (
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
        {getIcon()}
        <Typography level="body-sm" sx={{ color: "text.secondary", flex: 1 }}>
          {description}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
      {getIcon()}
      <Typography level="body-sm" sx={{ color: "text.secondary", flex: 1 }}>
        {description}
      </Typography>
      <Typography
        level="body-xs"
        sx={{ color: "text.tertiary", opacity: 0.7, ml: 1 }}
      >
        ({confidence}/10)
      </Typography>
    </Box>
  );
}

export function InsightsList({
  insights,
}: {
  insights: TickerSentimentPrediction["insights"];
}) {
  return (
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
                {insights.map((insight) => (
                  <InsightItem
                    key={insight.insight}
                    impact={insight.impact}
                    confidence={insight.confidence}
                    description={insight.reasoning}
                  />
                ))}
              </Stack>
            </Box>
          </MuiPopover>
        </div>
      )}
    </PopupState>
  );
}
