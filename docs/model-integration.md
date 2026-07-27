# Integração de modelos visuais

Data: 2026-07-25

## D3 local

A extensão inclui um encoder MobileNetV3 em ONNX e executa inferência em worker com `onnxruntime-web`.

- entrada: frames RGB normalizados em `224 × 224`;
- saída: embeddings de 1.280 dimensões;
- sinal: desvio-padrão das diferenças temporais de segunda ordem, seguindo a formulação D3;
- backend: WebGPU, com fallback WASM;
- modelo e hashes: `apps/extension/public/models/d3-mobilenetv3/model-card.json`.

O arquivo `encoder.onnx` tem SHA-256 `d5c33187c418a158aa5ee0a30b09f00f68300f0dff8968033d61838721d16b38`.

Os thresholds D3 ainda não passaram por validação separada. O runtime calcula e registra o sinal, mas retorna `uncertain` e `syntheticScore: null`. Isso evita transformar uma estatística real, porém não calibrada, em rótulo enganoso.

## STALL remoto

STALL é um detector training-free que usa DINOv3 ViT-L/16 e calibração VATEX. O wrapper local:

- importa a implementação oficial a partir de um diretório externo;
- fixa o commit `bfcc603ae83b4e609681277b9b5e80e7a9497e15`;
- verifica o SHA-256 dos parâmetros VATEX;
- converte a direção do score de “mais real” para “mais sintético”;
- não baixa código ou pesos durante a requisição;
- degrada para `unavailable` se qualquer artefato faltar.

Os pesos DINOv3 são grandes e não pertencem ao bundle da extensão. Eles rodam no servidor central; os computadores dos usuários continuam responsáveis apenas pelo detector local leve e pela captura reduzida.

Consulte [apps/api/README.md](../apps/api/README.md) para a configuração.

## Licenças e proveniência

- código D3: MIT;
- runtime ONNX: licença declarada pelo pacote upstream;
- STALL: CC BY-NC, sem redistribuição neste repositório;
- DINOv3 e seus pesos: termos do fornecedor;
- encoder ImageNet: fontes e commit registrados no model card.

Ativar STALL exige `STALL_NONCOMMERCIAL_ACKNOWLEDGED=true`. Distribuição pública ou uso comercial exige revisão jurídica das licenças.

## Portões de qualidade

Um detector só pode gerar evidência quando:

1. o arquivo e o pré-processamento correspondem ao model card;
2. a saída é finita e respeita o contrato;
3. thresholds foram validados em corpus separado;
4. versão e calibração entram no assessment/cache;
5. falsos positivos, falsos negativos e falhas são exibidos como limitações.

Mocks permanecem exclusivos dos testes. Falha do modelo real nunca usa mock como fallback.
