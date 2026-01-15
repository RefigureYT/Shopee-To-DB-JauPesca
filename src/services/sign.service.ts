import crypto from "node:crypto";

/**
 * Parâmetros usados para gerar a assinatura (`sign`) exigida pela Shopee Partner API.
 * A assinatura é um HMAC-SHA256 calculado sobre uma string base.
 *
 * Regras importantes:
 * - `path` deve ser somente o caminho do endpoint (ex.: `/api/v2/product/get_item_list`), sem host.
 * - `timestamp` deve estar em Unix timestamp (segundos).
 * - `accessToken` e `shopId` só entram na string base quando forem enviados na requisição.
 */
type SignPartnerArgs = {
    partnerId: number;
    partnerKey: string;
    path: string;
    timestamp: number;
    accessToken?: string;
    shopId?: number;
}

/**
 * Gera o `sign` (assinatura) exigido pela Shopee Partner API.
 *
 * A assinatura é calculada como:
 * - baseString = `${partnerId}${path}${timestamp}` + accessToken? + shopId?
 * - sign = HMAC_SHA256(baseString, partnerKey)
 *
 * @param args Dados necessários para montar a string base e assinar.
 * @returns Assinatura em hexadecimal (string).
 *
 * @example
 * const sign = signPartner({
 *   partnerId: 123,
 *   partnerKey: "abc",
 *   path: "/api/v2/product/get_item_list",
 *   timestamp: 1700000000,
 *   accessToken: "token",
 *   shopId: 999
 * });
 */
export function signPartner(
    {
        partnerId,
        partnerKey,
        path,
        timestamp,
        accessToken,
        shopId
    }: SignPartnerArgs): string {
    const baseString =
        `${partnerId}${path}${timestamp}` +
        (accessToken ?? "") +
        (shopId !== undefined ? String(shopId) : "");

    return crypto.createHmac("sha256", partnerKey.trim()).update(baseString, "utf8").digest("hex");
}