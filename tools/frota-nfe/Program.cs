// Frota NF-e — programa local do Frota Control
//
//   FrotaNfe consultar  -> consulta a SEFAZ (Distribuição DF-e) com o certificado A3
//                          da empresa e salva os XMLs das NF-e destinadas à Gadi
//   FrotaNfe backup     -> exporta todas as tabelas do Supabase para um .zip na
//                          Área de Trabalho (pasta "Backups Frota Control")
//
// Nenhuma senha, PIN ou chave fica gravada: o PIN do cartão é pedido pelo driver
// do Windows e a senha do Frota é digitada a cada execução.

using System.IO.Compression;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using FrotaNfe;

Console.OutputEncoding = Encoding.UTF8;
var cmd = args.Length > 0 ? args[0].ToLowerInvariant() : "";

try
{
    switch (cmd)
    {
        case "consultar": Sefaz.Verbose = args.Contains("-v"); await Sefaz.Consultar(); break;
        case "chave" when args.Length > 1: await Sefaz.ConsultarChave(args[1]); break;
        case "backup": await Backup.Run(); break;
        default:
            Console.WriteLine("Uso:");
            Console.WriteLine("  FrotaNfe consultar   consulta notas novas na SEFAZ (precisa do cartão)");
            Console.WriteLine("  FrotaNfe chave <44 dígitos>  consulta uma nota específica pela chave de acesso");
            Console.WriteLine("  FrotaNfe backup     salva backup de todas as tabelas na Área de Trabalho");
            return 1;
    }
    return 0;
}
catch (Exception ex)
{
    Console.ForegroundColor = ConsoleColor.Red;
    Console.WriteLine($"\nErro: {ex.Message}");
    for (var inner = ex.InnerException; inner != null; inner = inner.InnerException)
        Console.WriteLine($"  -> {inner.Message}");
    Console.ResetColor();
    return 2;
}

namespace FrotaNfe
{
    static class Config
    {
        public const string Cnpj = "13126912000156";
        public const string CUfAutor = "43"; // RS — UF da Gadi
        public const string SupabaseUrl = "https://gqoefhecnsayjxyoutzo.supabase.co";
        // Chave pública (anon) — a mesma do js/supabase-config.js; o acesso real é
        // controlado pelo login do admin + RLS.
        public const string SupabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdxb2VmaGVjbnNheWp4eW91dHpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5Njk3MTIsImV4cCI6MjA4NjU0NTcxMn0.WKJD2b59-pDXWXb0tDPPfXwu7GNncY_BHBjyBe9hY4k";

        public static readonly string DataDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "FrotaNfe");
    }

    static class Supabase
    {
        static readonly HttpClient Http = new() { BaseAddress = new Uri(Config.SupabaseUrl) };

        // Login com e-mail/senha do Frota Control; devolve o access token (JWT) da sessão.
        public static async Task<string> Login()
        {
            Console.Write("E-mail do Frota Control: ");
            var email = Console.ReadLine()?.Trim() ?? "";
            Console.Write("Senha: ");
            var senha = ReadPassword();

            var req = new HttpRequestMessage(HttpMethod.Post, "/auth/v1/token?grant_type=password")
            {
                Content = new StringContent(JsonSerializer.Serialize(new { email, password = senha }), Encoding.UTF8, "application/json")
            };
            req.Headers.Add("apikey", Config.SupabaseAnonKey);
            var res = await Http.SendAsync(req);
            var body = await res.Content.ReadAsStringAsync();
            if (!res.IsSuccessStatusCode) throw new Exception("Login recusado — confira e-mail e senha.");
            return JsonNode.Parse(body)!["access_token"]!.GetValue<string>();
        }

        // Lê uma tabela inteira, paginando de 1000 em 1000 (limite padrão do PostgREST).
        public static async Task<JsonArray?> SelectAll(string token, string table)
        {
            var all = new JsonArray();
            for (int from = 0; ; from += 1000)
            {
                var req = new HttpRequestMessage(HttpMethod.Get, $"/rest/v1/{table}?select=*");
                req.Headers.Add("apikey", Config.SupabaseAnonKey);
                req.Headers.Add("Authorization", $"Bearer {token}");
                req.Headers.Add("Range", $"{from}-{from + 999}");
                var res = await Http.SendAsync(req);
                if (res.StatusCode == System.Net.HttpStatusCode.NotFound) return null;
                var body = await res.Content.ReadAsStringAsync();
                if (!res.IsSuccessStatusCode) throw new Exception($"Falha ao ler {table}: {body}");
                var page = JsonNode.Parse(body)!.AsArray();
                var count = page.Count;
                foreach (var row in page.ToList()) { page.Remove(row); all.Add(row); }
                if (count < 1000) break;
            }
            return all;
        }

        static string ReadPassword()
        {
            var sb = new StringBuilder();
            while (true)
            {
                var k = Console.ReadKey(intercept: true);
                if (k.Key == ConsoleKey.Enter) { Console.WriteLine(); return sb.ToString(); }
                if (k.Key == ConsoleKey.Backspace) { if (sb.Length > 0) sb.Length--; continue; }
                sb.Append(k.KeyChar);
            }
        }
    }

    static class Backup
    {
        static readonly string[] Tables =
        {
            "app_users", "closings", "driver_bonuses", "driver_closings", "driver_discounts",
            "driver_expenses", "fines", "freights", "fuelings", "maintenance_plans",
            "miro_boletos", "miro_cobrancas", "nfe_inbox", "settings", "tires", "tires_history",
            "truck_closings", "truck_expenses", "trucks"
        };

        public static async Task Run()
        {
            var token = await Supabase.Login();
            var dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "Backups Frota Control");
            Directory.CreateDirectory(dir);
            var zipPath = Path.Combine(dir, $"backup-frota-{DateTime.Now:yyyy-MM-dd_HHmm}.zip");

            var json = new JsonSerializerOptions { WriteIndented = true, Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping };
            using (var zip = ZipFile.Open(zipPath, ZipArchiveMode.Create))
            {
                foreach (var t in Tables)
                {
                    var rows = await Supabase.SelectAll(token, t);
                    if (rows == null) { Console.WriteLine($"  {t,-18} (não existe, pulada)"); continue; }
                    var entry = zip.CreateEntry($"{t}.json", CompressionLevel.Optimal);
                    await using var s = entry.Open();
                    await JsonSerializer.SerializeAsync(s, rows, json);
                    Console.WriteLine($"  {t,-18} {rows.Count,6} linhas");
                }
            }
            Console.WriteLine($"\nBackup salvo em:\n  {zipPath}");
        }
    }
}
