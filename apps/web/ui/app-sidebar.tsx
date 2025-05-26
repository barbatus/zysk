"use client";

import {
  Box,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemDecorator,
  Sheet,
  Typography,
} from "@mui/joy";
import {
  Clock,
  Globe,
  LineChart,
  Menu,
  Settings,
  TrendingUp,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export function AppSidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isActive = (path: string) => {
    return pathname === path || pathname?.startsWith(`${path}/`);
  };

  const menuItems = [
    { path: "/stocks", icon: LineChart, label: "My Watchlist" },
    { path: "/market", icon: Globe, label: "Market Overview" },
    { path: "/history", icon: Clock, label: "Digest History" },
  ];

  const footerItems = [
    { path: "/settings", icon: Settings, label: "Settings" },
  ];

  return (
    <Sheet
      sx={{
        minWidth: isCollapsed ? 60 : 280,
        height: "100vh",
        position: "sticky",
        top: 0,
        borderRight: "1px solid",
        borderColor: "divider",
        display: "flex",
        flexDirection: "column",
        transition: "width 0.2s ease",
        zIndex: 40,
      }}
    >
      <Box
        sx={{
          p: isCollapsed ? 1 : 2,
          borderBottom: "1px solid",
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          justifyContent: isCollapsed ? "center" : "space-between",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            opacity: isCollapsed ? 0 : 1,
            transition: "opacity 0.2s ease",
          }}
        >
          {!isCollapsed && (
            <>
              <TrendingUp size={24} color="#0B6BCB" />
              <Typography level="h4" fontWeight="lg">
                TradeCast
              </Typography>
            </>
          )}
        </Box>
        <IconButton
          variant="plain"
          size="sm"
          onClick={() => {
            setIsCollapsed(!isCollapsed);
          }}
          sx={{
            minWidth: 32,
            minHeight: 32,
            m: 0,
            p: 0,
          }}
        >
          {isCollapsed ? <Menu size={18} /> : <X size={18} />}
        </IconButton>
      </Box>

      <Box sx={{ flex: 1, overflow: "auto" }}>
        <List sx={{ p: 1 }}>
          {menuItems.map((item) => (
            <ListItem key={item.path}>
              <ListItemButton
                component={Link}
                href={item.path}
                selected={isActive(item.path)}
                sx={{
                  borderRadius: "sm",
                  minHeight: 44,
                  justifyContent: isCollapsed ? "center" : "flex-start",
                  px: isCollapsed ? 1 : 2,
                }}
              >
                <ListItemDecorator sx={{ minInlineSize: "auto", mr: 0 }}>
                  <item.icon size={20} />
                </ListItemDecorator>
                {!isCollapsed && (
                  <Typography level="body-sm" sx={{ ml: 1 }}>
                    {item.label}
                  </Typography>
                )}
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>

      {/* Footer navigation */}
      <Box sx={{ borderTop: "1px solid", borderColor: "divider" }}>
        <List sx={{ p: 1 }}>
          {footerItems.map((item) => (
            <ListItem key={item.path}>
              <ListItemButton
                component={Link}
                href={item.path}
                selected={isActive(item.path)}
                sx={{
                  borderRadius: "sm",
                  minHeight: 44,
                  justifyContent: isCollapsed ? "center" : "flex-start",
                  px: isCollapsed ? 1 : 2,
                }}
              >
                <ListItemDecorator sx={{ minInlineSize: "auto", mr: 0 }}>
                  <item.icon size={20} />
                </ListItemDecorator>
                {!isCollapsed && (
                  <Typography level="body-sm" sx={{ ml: 1 }}>
                    {item.label}
                  </Typography>
                )}
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>
    </Sheet>
  );
}
