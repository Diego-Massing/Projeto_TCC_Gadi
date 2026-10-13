// Consulta à SEFAZ — Distribuição de DF-e (NT 2014.002), serviço do Ambiente Nacional.
// Autenticação TLS mútua com o certificado e-CNPJ A3 (cartão) direto do repositório
// do Windows; o driver do cartão pede o PIN na primeira conexão.

using System.IO.Compression;
using System.Security.Authentication;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.Json;
using System.Xml.Linq;

namespace FrotaNfe
{
    static class Sefaz
    {
        const string DistUrl = "https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx";
        const string DistAction = "http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse";
        static readonly XNamespace Nfe = "http://www.portalfiscal.inf.br/nfe";

        // A SEFAZ bloqueia por 1h quem consulta de novo depois de já estar em dia
        // (cStat 137 ou ultNSU == maxNSU) — erro 656 "consumo indevido".
        static readonly TimeSpan Espera = TimeSpan.FromHours(1);

        record State(long UltNsu, DateTime? EmDiaEm);

        static string StatePath => Path.Combine(Config.DataDir, "estado.json");
        static string XmlDir => Path.Combine(Config.DataDir, "xml");

        static State LoadState() =>
            File.Exists(StatePath) ? JsonSerializer.Deserialize<State>(File.ReadAllText(StatePath))! : new State(0, null);

        static void SaveState(State s)
        {
            Directory.CreateDirectory(Config.DataDir);
            File.WriteAllText(StatePath, JsonSerializer.Serialize(s));
        }

        public static X509Certificate2 FindCertificate()
        {
            using var store = new X509Store(StoreName.My, StoreLocation.CurrentUser);
            store.Open(OpenFlags.ReadOnly);
            var cert = store.Certificates
                .Where(c => c.HasPrivateKey && c.Subject.Contains(Config.Cnpj) && c.NotAfter > DateTime.Now)
                .OrderByDescending(c => c.NotAfter)
                .FirstOrDefault();
            return cert ?? throw new Exception($"Certificado do CNPJ {Config.Cnpj} não encontrado. O cartão está na leitora?");
        }

        public static bool Verbose;

        public static HttpClient CreateClient(X509Certificate2 cert)
        {
            var handler = new SocketsHttpHandler
            {
                SslOptions = new System.Net.Security.SslClientAuthenticationOptions
                {
                    EnabledSslProtocols = SslProtocols.Tls12,
                    AllowRenegotiation = true,
                    ClientCertificates = new X509CertificateCollection { cert },
                    LocalCertificateSelectionCallback = (_, host, _, remote, issuers) =>
                    {
                        if (Verbose) Console.WriteLine($"  [tls] servidor pediu certificado? {(remote != null ? "sim" : "não")} | emissores aceitos: {issuers?.Length ?? 0}");
                        return cert;
                    },
                },
            };
            return new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(60) };
        }

        public static async Task Consultar()
        {
            var state = LoadState();
            if (state.EmDiaEm is DateTime t && DateTime.Now - t < Espera)
            {
                var falta = Espera - (DateTime.Now - t);
                Console.WriteLine($"Já está tudo em dia (última consulta às {t:HH:mm}).");
                Console.WriteLine($"A SEFAZ só permite consultar de novo daqui a {falta.Minutes + 1} min.");
                return;
            }

            var cert = FindCertificate();
            Console.WriteLine($"Certificado: {cert.GetNameInfo(X509NameType.SimpleName, false)} (válido até {cert.NotAfter:dd/MM/yyyy})");
            Console.WriteLine("Conectando à SEFAZ — o cartão pode pedir o PIN...\n");
            using var http = CreateClient(cert);
            Directory.CreateDirectory(XmlDir);

            long ult = state.UltNsu;
            int novos = 0;
            while (true)
            {
                var ret = await DistNsu(http, ult);
                var cStat = ret.Element(Nfe + "cStat")?.Value;
                var xMotivo = ret.Element(Nfe + "xMotivo")?.Value;
                long ultNsu = long.Parse(ret.Element(Nfe + "ultNSU")?.Value ?? "0");
                long maxNsu = long.Parse(ret.Element(Nfe + "maxNSU")?.Value ?? "0");
                if (Verbose) Console.WriteLine($"  [sefaz] {cStat} {xMotivo} | ultNSU {ultNsu} maxNSU {maxNsu}");

                if (cStat == "137") { ult = Math.Max(ult, ultNsu); SaveState(new State(ult, DateTime.Now)); break; }
                if (cStat != "138") throw new Exception($"SEFAZ respondeu {cStat}: {xMotivo}");

                foreach (var doc in ret.Descendants(Nfe + "docZip"))
                {
                    var xml = Unzip(doc.Value);
                    var schema = doc.Attribute("schema")?.Value ?? "";
                    var nsu = doc.Attribute("NSU")?.Value ?? "";
                    var x = XElement.Parse(xml);
                    var chave = x.Descendants(Nfe + "chNFe").FirstOrDefault()?.Value
                                ?? x.Descendants(Nfe + "infNFe").FirstOrDefault()?.Attribute("Id")?.Value.Replace("NFe", "")
                                ?? nsu;
                    File.WriteAllText(Path.Combine(XmlDir, $"{nsu}_{schema.Split('_')[0]}_{chave}.xml"), xml);
                    novos++;
                    Console.WriteLine(Describe(schema, x, nsu));
                }

                ult = ultNsu;
                bool emDia = ultNsu >= maxNsu;
                SaveState(new State(ult, emDia ? DateTime.Now : null));
                if (emDia) break;
            }

            Console.WriteLine($"\n{novos} documento(s) novo(s). Último NSU: {ult}. XMLs em:\n  {XmlDir}");
        }

        // Consulta uma nota específica pela chave de acesso (consChNFe). Não mexe no
        // NSU nem na regra de 1h — serve para conferir se uma nota chega até a Gadi.
        public static async Task ConsultarChave(string chave)
        {
            chave = new string(chave.Where(char.IsDigit).ToArray());
            if (chave.Length != 44) throw new Exception("A chave de acesso tem 44 dígitos.");

            var cert = FindCertificate();
            Console.WriteLine($"Certificado: {cert.GetNameInfo(X509NameType.SimpleName, false)}");
            using var http = CreateClient(cert);
            Directory.CreateDirectory(XmlDir);

            var ret = await Dist(http, $"<consChNFe><chNFe>{chave}</chNFe></consChNFe>");
            Console.WriteLine($"SEFAZ: {ret.Element(Nfe + "cStat")?.Value} - {ret.Element(Nfe + "xMotivo")?.Value}");
            foreach (var doc in ret.Descendants(Nfe + "docZip"))
            {
                var xml = Unzip(doc.Value);
                var schema = doc.Attribute("schema")?.Value ?? "";
                var nsu = doc.Attribute("NSU")?.Value ?? "";
                File.WriteAllText(Path.Combine(XmlDir, $"{nsu}_{schema.Split('_')[0]}_{chave}.xml"), xml);
                Console.WriteLine(Describe(schema, XElement.Parse(xml), nsu));
            }
        }

        static Task<XElement> DistNsu(HttpClient http, long ultNsu) =>
            Dist(http, $"<distNSU><ultNSU>{ultNsu:D15}</ultNSU></distNSU>");

        static async Task<XElement> Dist(HttpClient http, string consulta)
        {
            var envelope =
$@"<soap12:Envelope xmlns:soap12=""http://www.w3.org/2003/05/soap-envelope""><soap12:Body>
<nfeDistDFeInteresse xmlns=""http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe""><nfeDadosMsg>
<distDFeInt xmlns=""http://www.portalfiscal.inf.br/nfe"" versao=""1.01""><tpAmb>1</tpAmb><cUFAutor>{Config.CUfAutor}</cUFAutor><CNPJ>{Config.Cnpj}</CNPJ>{consulta}</distDFeInt>
</nfeDadosMsg></nfeDistDFeInteresse></soap12:Body></soap12:Envelope>";

            var content = new StringContent(envelope, Encoding.UTF8);
            content.Headers.ContentType = System.Net.Http.Headers.MediaTypeHeaderValue.Parse(
                $"application/soap+xml; charset=utf-8; action=\"{DistAction}\"");
            var res = await http.PostAsync(DistUrl, content);
            var body = await res.Content.ReadAsStringAsync();
            if (!res.IsSuccessStatusCode) throw new Exception($"HTTP {(int)res.StatusCode} da SEFAZ: {body[..Math.Min(300, body.Length)]}");
            return XDocument.Parse(body).Descendants(Nfe + "retDistDFeInt").First();
        }

        static string Unzip(string b64)
        {
            using var gz = new GZipStream(new MemoryStream(Convert.FromBase64String(b64)), CompressionMode.Decompress);
            using var r = new StreamReader(gz, Encoding.UTF8);
            return r.ReadToEnd();
        }

        static string Describe(string schema, XElement x, string nsu)
        {
            string V(string n) => x.Descendants(Nfe + n).FirstOrDefault()?.Value ?? "";
            if (schema.StartsWith("resNFe"))
                return $"  [{nsu}] RESUMO   {V("dhEmi").PadRight(10)[..10]}  {V("xNome"),-40}  R$ {V("vNF")}";
            if (schema.StartsWith("procNFe"))
                return $"  [{nsu}] COMPLETA {V("dhEmi").PadRight(10)[..10]}  {x.Descendants(Nfe + "emit").Elements(Nfe + "xNome").FirstOrDefault()?.Value,-40}  R$ {V("vNF")}";
            return $"  [{nsu}] {schema.Split('_')[0]} {V("chNFe")} {V("descEvento")}";
        }
    }
}
