import { useLocalAuth } from "@/hooks/useLocalAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import { ArrowRightLeft, Boxes, ClipboardList, FileSearch, LayoutDashboard, LogOut, PackageCheck, PanelLeft, Route, ScanLine } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import LocalLogin from "./LocalLogin";
import { toast } from "sonner";

const menuItems = [
  { icon: LayoutDashboard, label: "Programação", path: "/", permission: "programming" },
  { icon: ClipboardList, label: "Ordens de Produção", path: "/ordens", permission: "orders" },
  { icon: Boxes, label: "Produto Venda", path: "/produtos", permission: "products" },
  { icon: ArrowRightLeft, label: "Transferir Estoque", path: "/estoque", permission: "stock" },
  { icon: PackageCheck, label: "Pacotes / Paletização", path: "/pacotes", permission: "packages" },
  { icon: Route, label: "Solicitações", path: "/solicitacoes", permission: "requests" },
  { icon: ScanLine, label: "Rastreabilidade", path: "/rastreabilidade", permission: "traceability" },
 ] as const;

const implementedPaths = new Set(["/", "/ordens", "/produtos", "/estoque", "/solicitacoes"]);

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useLocalAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) return <LocalLogin />;

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useLocalAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find(item => item.path === location);
  const isMobile = useIsMobile();
  const operatorStation = user?.operationalProfile === "operator";
  const programmerStation = user?.operationalProfile === "programmer";
  const machineControlStation = operatorStation || programmerStation;

  useEffect(() => {
    if (machineControlStation && location !== "/") setLocation("/");
  }, [location, machineControlStation, setLocation]);

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  if (machineControlStation && location !== "/") return null;

  if (machineControlStation) return <main className="min-h-dvh flex-1 bg-[#f6f7f4] p-3 sm:p-4">{children}</main>;

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-extrabold tracking-[-0.04em] truncate text-[#f7fbf8]">PRODUÇÃO</span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <p className="px-4 pt-4 pb-2 font-mono text-[9px] font-medium uppercase tracking-[0.18em] text-[#9eb6aa] group-data-[collapsible=icon]:hidden">Módulo operacional</p>
            <SidebarMenu className="px-2 py-1">
              {menuItems.map(item => {
                const isActive = location === item.path;
                const requiredPermission = user?.permissionRules[item.permission];
                const isAllowed = !requiredPermission || user?.permissions.includes(requiredPermission);
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => {
                        if (!isAllowed) {
                          toast.error("Acesso não autorizado", { description: "O seu usuário Firebird não possui a permissão necessária para este módulo." });
                          return;
                        }
                        if (implementedPaths.has(item.path)) setLocation(item.path);
                        else toast.info(`${item.label} em preparação`, { description: "Este módulo foi identificado no sistema Delphi e será conectado após a validação das consultas correspondentes." });
                      }}
                      tooltip={item.label}
                      className={`h-10 rounded-lg transition-all font-semibold text-[#d6e3dc] hover:bg-white/10 hover:text-white data-[active=true]:bg-[#e8f4ed] data-[active=true]:text-[#14604e] ${isAllowed ? "" : "opacity-45"}`}
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                      />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="m-3 rounded-xl border border-white/10 bg-white/[0.045] p-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border border-white/15 shrink-0">
                    <AvatarFallback className="bg-[#cce8d7] text-xs font-bold text-[#155c4b]">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-bold truncate leading-none text-white">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-[#b1c6ba] truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="tracking-tight text-foreground">
                    {activeMenuItem?.label ?? "Menu"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        <main className="min-h-screen flex-1 bg-[#f6f7f4] p-4 sm:p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </>
  );
}
