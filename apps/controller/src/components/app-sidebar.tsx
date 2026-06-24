import type { DisplayStatus } from "@tvsys/shared";
import type * as React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@tvsys/ui/components/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarSeparator,
} from "@tvsys/ui/components/sidebar";
import { Badge } from "@tvsys/ui/components/badge";
import { Building2, ChevronRight, Monitor } from "lucide-react";
import { NavUser, type SidebarUser } from "./nav-user.js";

export interface Company {
  id: string;
  name: string;
  plan: string;
  region: string;
  groups: string[];
  deviceIds?: string[];
}

export interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  companies: Company[];
  companyDisplays: Record<string, DisplayStatus[]>;
  user: SidebarUser;
  selectedCompanyId: string;
  selectedDisplayId: string;
  screenFilter: "all" | "online" | "offline";
  onSignOut?: () => void;
}

export function AppSidebar({
  companies,
  companyDisplays,
  onSignOut,
  user,
  selectedCompanyId,
  selectedDisplayId,
  screenFilter,
  ...props
}: AppSidebarProps) {
  const navigate = useNavigate();
  const totalDisplays = Object.values(companyDisplays).reduce(
    (count, displays) => count + displays.length,
    0,
  );
  const onlineDisplays = Object.values(companyDisplays).reduce(
    (count, displays) =>
      count + displays.filter((display) => display.online).length,
    0,
  );

  return (
    <Sidebar variant="inset" collapsible="icon" {...props}>
      <SidebarHeader>
        <NavUser onSignOut={onSignOut} user={user} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Locations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {companies.map((company) => {
                const displays = companyDisplays[company.id] ?? [];
                const hasDisplays = displays.length > 0;
                const isActive = selectedCompanyId === company.id;

                return (
                  <Collapsible
                    key={`${company.id}-${isActive ? "active" : "inactive"}`}
                    asChild
                    defaultOpen={isActive && hasDisplays}
                  >
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        className={hasDisplays ? "pr-14" : "pr-8"}
                        isActive={isActive}
                        tooltip={company.name}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            void navigate({
                              to: "/companies/$companyId",
                              params: { companyId: company.id },
                              search: { filter: screenFilter },
                            });
                          }}
                        >
                          <Building2 />
                          <span>{company.name}</span>
                        </button>
                      </SidebarMenuButton>
                      <SidebarMenuBadge className={hasDisplays ? "right-7" : "right-1"}>
                        {displays.length}
                      </SidebarMenuBadge>
                      {hasDisplays ? (
                        <CollapsibleTrigger asChild>
                          <SidebarMenuAction className="right-1 data-[state=open]:rotate-90">
                            <ChevronRight />
                            <span className="sr-only">Toggle screens</span>
                          </SidebarMenuAction>
                        </CollapsibleTrigger>
                      ) : null}
                      {hasDisplays ? (
                        <CollapsibleContent>
                        <SidebarMenuSub>
                          {displays.map((display) => (
                              <SidebarMenuSubItem key={display.id}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={selectedDisplayId === display.id}
                                >
                                  <Link
                                    to="/companies/$companyId/displays/$displayId"
                                    params={{
                                      companyId: company.id,
                                      displayId: display.id,
                                    }}
                                    search={{ filter: screenFilter }}
                                  >
                                    <span
                                      className={`size-2 rounded-full ${display.online ? "bg-emerald-500" : "bg-muted-foreground/50"}`}
                                    />
                                    <span>{display.name ?? display.id}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                        </CollapsibleContent>
                      ) : null}
                    </SidebarMenuItem>
                  </Collapsible>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarSeparator />
      <div className="p-2 group-data-[collapsible=icon]:hidden">
        <div className="rounded-lg border bg-background p-3 text-xs text-muted-foreground">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="font-medium text-foreground">Fleet health</span>
            <Badge
              variant={
                onlineDisplays === totalDisplays && totalDisplays > 0
                  ? "secondary"
                  : "outline"
              }
            >
              {onlineDisplays} online
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Monitor className="size-3.5" />
            <span>{totalDisplays} registered displays</span>
          </div>
        </div>
      </div>
      <SidebarRail />
    </Sidebar>
  );
}
