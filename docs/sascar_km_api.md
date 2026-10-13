# Sascar / Michelin MyConnectedFleet — Captura de KM via API

## 1. Como funciona a captura atual (KM em tempo real)

O scraper atual (`scraper.py`) busca o hodômetro **atual** de cada veículo via endpoint de última posição.

### Endpoint

```
POST https://sasweb2-mod-bff-v1-sasweb2-produto-prd.apps.ocp4.sascar.com.br
     /lastposition-map/v2/veiculos-ultima-posicao
```

### Body

```json
{ "userId": 194432 }
```

### Autenticação

A plataforma usa **OAuth2 PKCE via Keycloak** + troca por token BFF:

1. **PKCE** → `POST https://iam.sascar.com.br/auth/realms/user-auth-temp/protocol/openid-connect/auth`  
   Parâmetros: `client_id=app-clients`, `response_type=code`, `code_challenge` (SHA-256)

2. **Token Keycloak** → `POST .../openid-connect/token`  
   Body: `grant_type=authorization_code`, `code=<code>`, `code_verifier=<verifier>`

3. **Token BFF** → `POST .../authentication/token`  
   Header: `Authorization: Bearer <keycloak_token>`  
   Retorna: `{ "token": "<bff_token>" }`

O `bff_token` é um JWT HS512 usado em **todas** as chamadas ao BFF.

### Headers para chamadas BFF

```python
{
    "Authorization": f"Bearer {bff_token}",
    "MyToken": bff_token,
    "Content-Type": "application/json",
    "Content-Language": "ES_AR",
    "Referer": "https://myconnectedfleet.michelin.com/main.html",
}
```

### Resposta — campo `hodometer`

```json
{
  "payload": [
    {
      "vehiclePlate": "ITM0F71",
      "vehicleNick": "LUIS RICARDO FER",
      "identifierVehicle": 1705639,
      "hodometer": 15741504,
      ...
    }
  ]
}
```

O campo `hodometer` está em **unidades de 100 m** (decâmetros). Para converter em km:

```python
HODOMETER_TO_KM = 10
km = int(hodometer) / HODOMETER_TO_KM
```

---

## 2. Busca histórica com filtro de data (Diario de Posiciones)

Para calcular o KM rodado em um período (ex: mês de junho), usa-se o endpoint
**Diario de Posiciones** do BFF, que retorna todas as posições GPS de um veículo
em uma data específica, já com o hodômetro em **km** (sem conversão).

### Endpoint

```
POST https://sasweb2-mod-bff-v1-sasweb2-produto-prd.apps.ocp4.sascar.com.br
     /sasweb2-mod-relatorio-posicoes/posicoes
```

### Body

```json
{
  "idContract": 22603,
  "dailyPosition": {
    "dateFromLong": 1780282800000,
    "dateToLong":   1780369140000,
    "identifierDeviceType": 79,
    "identifierClient":      160338,
    "identifierUser":        194432,
    "identifierVehicles":    2141652,
    "identifiersVehicles":   2141652,
    "identifierVehiclesList": 2141652,
    "identifierVehicle":     2141652,
    "identifierDrivers": [],
    "identifierDriver":  [],
    "nameDriver": null,
    "dateOption":  "custom",
    "timeOption":  "full",
    "timezoneUser": "America/Sao_Paulo",
    "dateEventFrom": 1780282800000,
    "dateEventTo":   1780369140000,
    "innerIdentifierClient": 160338
  }
}
```

### Parâmetros fixos da conta Transportes Gadi

| Campo | Valor |
|-------|-------|
| `idContract` | 22603 |
| `identifierClient` | 160338 |
| `innerIdentifierClient` | 160338 |
| `identifierUser` | 194432 |
| `identifierDeviceType` | 79 |

### Como calcular os timestamps

Os timestamps são em **milissegundos UTC** (epoch). O fuso é `America/Sao_Paulo` (UTC-3):

```python
from datetime import datetime, timezone, timedelta

SP = timezone(timedelta(hours=-3))

def ts_ms(year, month, day, hour=0, minute=0):
    dt = datetime(year, month, day, hour, minute, tzinfo=SP)
    return int(dt.timestamp() * 1000)

# 01/06/2026 00:00 SP
DATE_01JUN_FROM = ts_ms(2026, 6, 1, 0, 0)   # 1780282800000
DATE_01JUN_TO   = ts_ms(2026, 6, 1, 23, 59) # 1780369140000

# 30/06/2026 00:00 SP
DATE_30JUN_FROM = ts_ms(2026, 6, 30, 0, 0)   # 1782788400000
DATE_30JUN_TO   = ts_ms(2026, 6, 30, 23, 59) # 1782874740000
```

### Resposta

```json
{
  "header": { "mensagem": { "status": "SUCESSO" } },
  "payload": [
    {
      "hodometer": 700079.8,
      "speed": 0,
      "ignition": 0,
      "latitude": -28.633,
      "longitude": -56.002,
      "datePosition": 1780282800123,
      ...
    },
    ...
  ]
}
```

- `payload` está ordenado **cronologicamente** (posição mais antiga primeiro).
- `hodometer` já está em **km** (sem conversão).
- `payload[0].hodometer` = hodômetro no início da data.
- `payload[-1].hodometer` = hodômetro no final da data.

### Fórmula para KM do mês

```python
def km_do_mes(payload_dia1, payload_ultimo_dia):
    hodo_inicio = payload_dia1[0]["hodometer"]       # primeiro do mês
    hodo_fim    = payload_ultimo_dia[-1]["hodometer"] # último do mês
    return round(hodo_fim - hodo_inicio, 1)
```

---

## 3. Mapeamento de veículos (Transportes Gadi)

> Fonte: `veiculos-ultima-posicao` + `posicoes` (julho/2026)

| Placa | Motorista | `identifierVehicle` |
|-------|-----------|---------------------|
| FGF1573 | VAINE DELMAR | 1450130 |
| FHE4309 | ANDRESSA | 1445299 |
| GEM8457 | RENATO MACHADO | 1450129 |
| ITM0F71 | LUIS RICARDO FER | 1705639 |
| ITX8F86 | DIONATAS | 1705714 |
| IYG9E25 | SARTORI | 2141652 |
| JBX9H22 | CARLOS NUNES | 2182462 |
| JBY1F61 | EVERALDO | 1895429 |
| JCC6I39 | KELLY | 1929074 |
| JCC7C81 | SILVIOMAR COGO | 1929075 |
| MIP3G50 | ADILSON FERNANDO | 1807183 |
| QIH4A39 | JOAB MESSINA | 2192290 |

---

## 4. Exemplo completo em Python

```python
import requests
from datetime import datetime, timezone, timedelta

BFF_BASE = "https://sasweb2-mod-bff-v1-sasweb2-produto-prd.apps.ocp4.sascar.com.br"
POSICOES_URL = f"{BFF_BASE}/sasweb2-mod-relatorio-posicoes/posicoes"

SP = timezone(timedelta(hours=-3))

def ts_ms(year, month, day, hour=0, minute=0):
    return int(datetime(year, month, day, hour, minute, tzinfo=SP).timestamp() * 1000)

def chamar_posicoes(bff_token, vehicle_id, date_from, date_to):
    headers = {
        "Authorization": f"Bearer {bff_token}",
        "MyToken": bff_token,
        "Content-Type": "application/json",
        "Content-Language": "ES_AR",
        "Referer": "https://myconnectedfleet.michelin.com/main.html",
    }
    body = {
        "idContract": 22603,
        "dailyPosition": {
            "dateFromLong": date_from, "dateToLong": date_to,
            "identifierDeviceType": 79,
            "identifierClient": 160338, "identifierUser": 194432,
            "identifierVehicles": vehicle_id, "identifiersVehicles": vehicle_id,
            "identifierVehiclesList": vehicle_id, "identifierVehicle": vehicle_id,
            "identifierDrivers": [], "identifierDriver": [],
            "nameDriver": None, "dateOption": "custom", "timeOption": "full",
            "timezoneUser": "America/Sao_Paulo",
            "dateEventFrom": date_from, "dateEventTo": date_to,
            "innerIdentifierClient": 160338,
        }
    }
    r = requests.post(POSICOES_URL, json=body, headers=headers, timeout=30)
    if r.status_code == 200:
        return r.json().get("payload", [])
    return []

# Uso
vehicle_id = 2141652  # IYG9E25 (SARTORI)
p_inicio = chamar_posicoes(token, vehicle_id, ts_ms(2026,6,1), ts_ms(2026,6,1,23,59))
p_fim    = chamar_posicoes(token, vehicle_id, ts_ms(2026,6,30), ts_ms(2026,6,30,23,59))

km_junho = p_fim[-1]["hodometer"] - p_inicio[0]["hodometer"]
print(f"KM rodados em junho: {km_junho:.1f} km")
```

---

## 5. Observações importantes

- O endpoint aceita **apenas 1 veículo por requisição** (`identifierVehicle` é singular).
- Limite de datas: o portal bloqueia ranges acima de 7 dias via endpoint de validação (`max-days-allowed-to-consolidation`), mas chamadas diretas à API aceitam qualquer range.
- Se `payload` vier vazio para uma data, o veículo estava sem sinal GPS naquele dia. Nesse caso, use a data anterior com posições disponíveis.
- O `idContract` (22603) é específico do módulo **Diario de Posiciones** e difere do usado no Control de Recorrido (49186).
