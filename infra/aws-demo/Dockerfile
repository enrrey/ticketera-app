FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ENV NEXT_TELEMETRY_DISABLED=1 TICKETERA_BUILD_TARGET=lambda
RUN node -e 'for(const name of ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY","NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"])if(!process.env[name]?.startsWith("pk_test_"))throw new Error(name+" debe ser de sandbox")'
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
# Official AWS adapter; single-architecture image built by GitHub Actions.
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:1.1.0 /lambda-adapter /opt/extensions/lambda-adapter
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/infra/aws-demo/start.mjs ./start-demo.mjs
RUN ln -s /tmp/ticketera-cache .next/cache
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=8080 HOSTNAME=0.0.0.0
ENV AWS_LWA_PORT=8080 AWS_LWA_INVOKE_MODE=buffered NOTIFICATIONS_ENABLED=false
USER node
CMD ["node", "start-demo.mjs"]
