import { configDotenv } from "dotenv";
import chalk from "chalk";
configDotenv();

// ================= INTERFACES E TIPOS =================
interface DatabaseInfos {
    databaseTable: string;
    databaseSchema: string;
    databaseUrl: string;
}
interface InfoSellerConfig {
    partnerId: number;
    partnerKey: string;
    host: string;
    shopId: number;
    accessToken: string;
}
// ======================================================
// const _accessToken: string = process.env["ACCESS_TOKEN"] || "";
const _shopId: string = process.env["SHOP_ID"] || "";
const _partnerKey: string = process.env["PARTNER_KEY"] || "";
const _partnerId: string = process.env["PARTNER_ID"] || "";
const _host: string = process.env["HOST"] || "https://partner.shopeemobile.com"; //? URL de produção como fallback

const _databaseUrl: string = process.env["DATABASE_URL"] || "";
const _databaseSchema: string = process.env["DB_SCHEMA"] || "";
const _databaseTable: string = process.env["DB_TABLE"] || "";

const _databaseUrlMarketplace: string = process.env["MARKETPLACES_DATABASE_URL"] || "";

// if (_accessToken === "" || _shopId === "" || _partnerKey === "" || _partnerId === "" || _databaseUrl === "" || _databaseSchema === "" || _databaseTable === "") {
if (_shopId === "" || _partnerKey === "" || _partnerId === "" || _databaseUrl === "" || _databaseSchema === "" || _databaseTable === "" || _databaseUrlMarketplace === "") {
    console.error(chalk.red.bold("❌ Erro: Arquivo de variáveis do ambiente está incompleto."));
    console.log(chalk.blue("Por favor siga o padrão abaixo:"));
    console.log(chalk.cyan.bold(`SHOP_ID=""
PARTNER_KEY=""
PARTNER_ID=""
HOST="https://partner.shopeemobile.com" # Ou https://partner.test-stable.shopeemobile.com se for teste
DATABASE_URL="postgres://USUARIO:SENHA@HOST:5432/NOME_DO_BANCO
DB_SCHEMA=""
DB_TABLE=""
MARKETPLACES_DATABASE_URL="postgres://USUARIO:SENHA@HOST:5432/NOME_DO_BANCO
`));
    process.exit(1);
}

export const InfoSellerConfig: InfoSellerConfig = {
    partnerId: parseInt(_partnerId),
    partnerKey: _partnerKey,
    host: _host,
    shopId: parseInt(_shopId),
    accessToken: "",
};

export const databaseInfosForAccessToken: Readonly<DatabaseInfos> = {
    databaseTable: _databaseTable,
    databaseSchema: _databaseSchema,
    databaseUrl: _databaseUrl,
} as const;

export const databaseInfosForMarketplace: Readonly<DatabaseInfos> = {
    databaseUrl: _databaseUrlMarketplace,
    databaseSchema: '',
    databaseTable: '',
} as const;