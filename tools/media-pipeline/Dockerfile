# riftden-media: offline pipeline for skin models, voice-over and pictures.
# Build:  docker build -t riftden-media:<tag> tools/media-pipeline
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS riftmodel
WORKDIR /src
COPY riftmodel/riftmodel.csproj riftmodel/*.cs ./
RUN dotnet publish -c Release -r linux-x64 --self-contained true -p:PublishSingleFile=true -o /out

FROM node:22.23.2-bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl unzip ffmpeg webp libavif-bin python3 python3-venv git \
 && rm -rf /var/lib/apt/lists/*

# vgmstream r2168 (Wwise .wem decoder), pinned by checksum
RUN curl -fsSL -o /tmp/vgm.zip https://github.com/vgmstream/vgmstream/releases/download/r2168/vgmstream-linux.zip \
 && echo "2dfdfddda68e0e36e62f20dc050a4e45f4bc3318c7efeadf8a063df646d57c84  /tmp/vgm.zip" | sha256sum -c - \
 && unzip -q /tmp/vgm.zip -d /usr/local/bin vgmstream-cli && chmod 755 /usr/local/bin/vgmstream-cli && rm /tmp/vgm.zip

# CommunityDragon toolbox (WAD/BIN/RMAN readers), pinned commit
RUN python3 -m venv /opt/venv \
 && /opt/venv/bin/pip install --no-cache-dir "git+https://github.com/CommunityDragon/CDTB.git@f9d6c179b919752118cc6b3111acc6283b584162" \
 && apt-get purge -y git && apt-get autoremove -y

COPY node/package.json node/package-lock.json /opt/media/node/
RUN cd /opt/media/node && npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=riftmodel /out/riftmodel /opt/riftmodel/riftmodel
COPY node/optimize.mjs /opt/media/node/
COPY pipeline/ /opt/media/pipeline/

ENV RIFTMODEL=/opt/riftmodel/riftmodel OPTIMIZE_JS=/opt/media/node/optimize.mjs PYTHONUNBUFFERED=1 \
    DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1 HOME=/tmp
USER node
WORKDIR /opt/media/pipeline
ENTRYPOINT ["/opt/venv/bin/python", "/opt/media/pipeline/run.py"]
