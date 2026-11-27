"""A first data exchange in this dataspace, with nothing but the Python standard library.

The provider offers an asset under the Catena-X framework agreement; the consumer
reads the provider's catalog, negotiates a contract, starts an HttpData-PULL
transfer and pulls the data through the provider's data plane. Every request is
a plain management API call you can copy into your own client.

    python3 exchange.py
"""
import json, os, sys, time, urllib.request, urllib.error

G = f"http://localhost:{os.environ.get('GATEWAY_PORT', '8080')}"
CTX = ["https://w3id.org/catenax/2025/9/policy/context.jsonld", "https://w3id.org/edc/connector/management/v0.0.1"]
# @defaults
DSP = f"http://{PROVIDER}-dsp.local/api/v1/dsp/2025-1"
PROTOCOL = "dataspace-protocol-http:2025-1"

def call(method, url, body=None, headers=None, ok=(200, 204, 409)):
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(url, data=data, method=method, headers={"x-api-key": "password", "Content-Type": "application/json", **(headers or {})})
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            text = response.read().decode()
            return json.loads(text) if text and text.lstrip()[:1] in "[{" else text
    except urllib.error.HTTPError as error:
        if error.code in ok:
            return None
        sys.exit(f"{method} {url} -> {error.code} {error.read().decode()[:600]}")

p, c = f"{G}/{PROVIDER}/management", f"{G}/{CONSUMER}/management"
call("POST", f"{p}/v3/assets", {"@context": CTX, "@id": "e2e-asset", "properties": {"name": "e2e"},
     "dataAddress": {"@type": "DataAddress", "type": "HttpData", "baseUrl": BACKEND, "proxyPath": "true"}})
for pid, action, constraint in [
    ("e2e-policy", "access", {"leftOperand": "FrameworkAgreement", "operator": "eq", "rightOperand": "DataExchangeGovernance:1.0"}),
    ("e2e-usage", "use", {"and": [{"leftOperand": "FrameworkAgreement", "operator": "eq", "rightOperand": "DataExchangeGovernance:1.0"},
                                  {"leftOperand": "UsagePurpose", "operator": "isAnyOf", "rightOperand": "cx.core.industrycore:1"}]}),
]:
    call("POST", f"{p}/v3/policydefinitions", {"@context": CTX, "@type": "PolicyDefinition", "@id": pid,
         "policy": {"@type": "Set", "permission": [{"action": action, "constraint": constraint}]}})
call("POST", f"{p}/v3/contractdefinitions", {"@context": CTX, "@type": "ContractDefinition", "@id": "e2e-contract",
     "accessPolicyId": "e2e-policy", "contractPolicyId": "e2e-usage", "assetsSelector": []})
print("provider: asset, policies and contract definition in place")

catalog = call("POST", f"{c}/v3/catalog/request", {"@context": CTX, "@type": "CatalogRequest", "counterPartyAddress": DSP,
               "counterPartyId": PROVIDER_DID, "protocol": PROTOCOL,
               "querySpec": {"filterExpression": [{"operandLeft": "https://w3id.org/edc/v0.0.1/ns/id", "operator": "=", "operandRight": "e2e-asset"}]}})
datasets = catalog.get("dataset") or catalog.get("dcat:dataset") or []
datasets = datasets if isinstance(datasets, list) else [datasets]
if not datasets:
    sys.exit(f"the catalog has no e2e-asset: {json.dumps(catalog)[:600]}")
offer = datasets[0].get("hasPolicy") or datasets[0].get("odrl:hasPolicy")
offer = offer[0] if isinstance(offer, list) else offer
print(f"consumer: catalog offers e2e-asset ({offer['@id'][:40]}...)")
offer = {**offer, "assigner": PROVIDER_DID, "target": "e2e-asset"}
negotiation = call("POST", f"{c}/v3/contractnegotiations", {"@context": CTX, "@type": "ContractRequest",
                   "counterPartyAddress": DSP, "protocol": PROTOCOL, "policy": offer})["@id"]
for _ in range(60):
    state = call("GET", f"{c}/v3/contractnegotiations/{negotiation}")
    if state["state"] in ("FINALIZED", "TERMINATED"):
        break
    time.sleep(1)
print(f"consumer: negotiation {state['state']} {state.get('errorDetail', '')}")
if state["state"] != "FINALIZED":
    sys.exit(1)
transfer = call("POST", f"{c}/v3/transferprocesses", {"@context": CTX, "@type": "TransferRequest", "counterPartyAddress": DSP,
                "protocol": PROTOCOL, "contractId": state["contractAgreementId"], "transferType": "HttpData-PULL"})["@id"]
for _ in range(60):
    state = call("GET", f"{c}/v3/transferprocesses/{transfer}")
    if state["state"] in ("STARTED", "TERMINATED"):
        break
    time.sleep(1)
print(f"consumer: transfer {state['state']} {state.get('errorDetail', '')}")
if state["state"] != "STARTED":
    sys.exit(1)
for _ in range(20):
    edr = call("GET", f"{c}/v3/edrs/{transfer}/dataaddress", ok=(404,))
    if edr:
        break
    time.sleep(1)
endpoint = edr["endpoint"]
# The data plane's address is a host inside the network: go through the gateway with it.
host = endpoint.split("/")[2]
path = "/" + endpoint.split("/", 3)[3]
body = call("GET", f"{G}{path}", headers={"Host": host, "Authorization": edr["authorization"], "x-api-key": ""})
print(f"consumer: pulled through {endpoint}:\n  {str(body).strip()[:200]}")
