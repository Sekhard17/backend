import dotenv from 'dotenv'

// Cargamos las variables de entorno
dotenv.config()

const {
  NODE_ENV: environment = 'development',
  PORT: port = '3000',
  CORS_ORIGIN: cors_origin = 'http://localhost:5173',
  JWT_SECRET: jwt_secret = 'default_secret_key',
  JWT_EXPIRES_IN: jwt_expires_in = '2h'
} = process.env

// Definimos un tipo para nuestra configuración
export type EnvConfig = {
  environment: string
  port: string
  cors_origin: string
  jwt_secret: string
  jwt_expires_in: string
}

// Exportamos la configuración tipada
export const config: EnvConfig = {
  environment,
  port,
  cors_origin,
  jwt_secret,
  jwt_expires_in
}

export default config