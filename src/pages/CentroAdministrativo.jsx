import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ADMIN_TOOL_TABS, getAdminToolsByCategory } from '@/config/adminToolsRegistry';

export default function CentroAdministrativo() {
  const defaultTab = ADMIN_TOOL_TABS[0]?.key || 'auditorias';

  return (
    <div className="p-4 md:p-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Centro Administrativo</CardTitle>
          <CardDescription>
            Hub central para ferramentas administrativas. Menus legados permanecem inalterados nesta entrega.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="flex flex-wrap h-auto gap-2">
              {ADMIN_TOOL_TABS.map((tab) => (
                <TabsTrigger key={tab.key} value={tab.key}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {ADMIN_TOOL_TABS.map((tab) => {
              const tools = getAdminToolsByCategory(tab.key);
              return (
                <TabsContent key={tab.key} value={tab.key} className="pt-4">
                  {tools.length === 0 ? (
                    <p className="text-sm text-slate-600">
                      Nenhuma ferramenta registrada nesta aba por enquanto.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {tools.map((tool) => (
                        <li key={tool.key} className="text-sm text-slate-700">{tool.label}</li>
                      ))}
                    </ul>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
