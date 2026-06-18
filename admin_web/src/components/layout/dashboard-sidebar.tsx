import { Logo } from '@/components/shared/logo';
import { SidebarMain } from '@/components/layout/sidebar-main';
import { SidebarUser } from '@/components/layout/sidebar-user';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { websiteConfig } from '@/config/website';
import { authClient } from '@/auth/client';
import { Link } from '@tanstack/react-router';
import { Routes } from '@/lib/routes';
import type * as React from 'react';
import { useEffect, useState } from 'react';

/**
 * Dashboard sidebar
 */
export function DashboardSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const [mounted, setMounted] = useState(false);
  const { data: session, isPending } = authClient.useSession();
  const currentUser = session?.user;
  const { isMobile, setOpenMobile } = useSidebar();

  useEffect(() => {
    setMounted(true);
  }, []);

  const closeMobileSidebar = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={
                <Link to={Routes.Root} onClick={closeMobileSidebar}>
                  <Logo className="size-5" />
                  <span className="truncate font-semibold text-base">
                    {websiteConfig.metadata?.name}
                  </span>
                </Link>
              }
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {!isPending && mounted && <SidebarMain />}
      </SidebarContent>

      <SidebarFooter className="flex flex-col gap-4">
        {!isPending && mounted && currentUser && (
          <SidebarUser user={currentUser} />
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
