import Avatar from "@mui/joy/Avatar";
import Box from "@mui/joy/Box";
import Dropdown from "@mui/joy/Dropdown";
import Menu from "@mui/joy/Menu";
import MenuButton from "@mui/joy/MenuButton";
import MenuItem from "@mui/joy/MenuItem";
import { type ReactNode } from "react";

import { AppSidebar } from "#/ui/app-sidebar";

export function PageLayout({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        "--Content-background": "var(--joy-palette-background-body)",
        "--Content-radius": "var(--joy-radius-xl)",
        "--Content-paddingX": "24px",
        "--Content-paddingY": "24px",
        "--Content-padding": "var(--Content-paddingY) var(--Content-paddingX)",
        bgcolor: "var(--Content-background)",
        display: "flex",
        flex: "1 1 auto",
        flexDirection: "column",
        position: "relative",
        width: "100%",
      }}
    >
      <Box sx={{ display: "flex", minHeight: "100vh" }}>
        <AppSidebar />
        <Box component="main" sx={{ flexGrow: 1, width: "100%" }}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              py: 1.5,
            }}
          >
            <Box />
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, px: 3 }}>
              <Dropdown>
                <MenuButton
                  variant="outlined"
                  color="neutral"
                  size="sm"
                  sx={{ borderRadius: "50%", p: 0 }}
                >
                  <Avatar
                    src="/placeholder.svg?height=32&width=32"
                    alt="Avatar"
                  />
                </MenuButton>
                <Menu>
                  <MenuItem>My Account</MenuItem>
                  <MenuItem>Email Preferences</MenuItem>
                  <MenuItem>Settings</MenuItem>
                  <MenuItem>Logout</MenuItem>
                </Menu>
              </Dropdown>
            </Box>
          </Box>
          <Box sx={{ px: 4 }}>{children}</Box>
        </Box>
      </Box>
    </Box>
  );
}
