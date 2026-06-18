import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { getSidebarLinks } from '@/config/sidebar-config';
import type { MenuItemConfig } from '@/types';
import { Link, useRouterState } from '@tanstack/react-router';
import { authClient } from '@/auth/client';
import { useMemo } from 'react';

/**
 * Filters sidebar links based on user role (authorizeOnly)
 */
function useFilteredSidebarLinks(): MenuItemConfig[] {
  const links = getSidebarLinks();
  const { data: session } = authClient.useSession();
  const userRole = session?.user?.role;

  return useMemo(() => {
    const filterByRole = (items: MenuItemConfig[]): MenuItemConfig[] => {
      return items
        .filter((item) => {
          if (!item.authorizeOnly) return true;
          if (!userRole) return false;
          return item.authorizeOnly.includes(userRole);
        })
        .map((item) => {
          if (item.items && item.items.length > 0) {
            const filteredItems = filterByRole(item.items);
            return filteredItems.length > 0
              ? { ...item, items: filteredItems }
              : null;
          }
          return item;
        })
        .filter((item): item is MenuItemConfig => item !== null);
    };

    return filterByRole(links);
  }, [links, userRole]);
}

export function SidebarMain() {
  const items = useFilteredSidebarLinks();
  const pathname = useRouterState({ select: (s) => s.location.pathname }) ?? '';
  const { isMobile, setOpenMobile } = useSidebar();

  const closeMobileSidebar = () => {
    if (isMobile) setOpenMobile(false);
  };

  const isActive = (href: string | undefined): boolean => {
    if (!href) return false;
    const p = pathname.replace(/\/$/, '') || '/';
    const h = href.replace(/\/$/, '') || '/';
    return p === h;
  };

  const renderItem = (item: MenuItemConfig, key: string) => {
    const Icon = item.icon;
    if (item.items && item.items.length > 0) {
      return (
        <SidebarGroup key={key}>
          <SidebarGroupLabel>{item.title}</SidebarGroupLabel>
          <SidebarGroupContent className="flex flex-col gap-0.5">
            <SidebarMenu>
              {item.items.map((sub) => {
                const SubIcon = sub.icon;
                return (
                  <SidebarMenuItem key={sub.title} className="py-1">
                    <SidebarMenuButton
                      render={
                        <Link to={sub.href ?? '#'} onClick={closeMobileSidebar}>
                          {SubIcon ? (
                            <SubIcon className="size-4 shrink-0" />
                          ) : null}
                          <span className="truncate font-medium text-sm">
                            {sub.title}
                          </span>
                        </Link>
                      }
                      isActive={isActive(sub.href)}
                    />
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      );
    }
    return (
      <SidebarGroup key={key}>
        <SidebarGroupContent className="flex flex-col gap-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={
                  <Link to={item.href ?? '#'} onClick={closeMobileSidebar}>
                    {Icon ? <Icon className="size-4 shrink-0" /> : null}
                    <span className="truncate font-medium text-sm">
                      {item.title}
                    </span>
                  </Link>
                }
                isActive={isActive(item.href)}
              />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  return (
    <>
      {items.map((item) =>
        renderItem(
          item,
          item.title + (item.items?.map((i) => i.title).join('-') ?? '')
        )
      )}
    </>
  );
}
