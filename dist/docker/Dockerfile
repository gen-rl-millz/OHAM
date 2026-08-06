# docker run -p 8207:8207 -v $PWD/clips:/clips ghcr.io/gen-rl-millz/oham serve /clips
# The vault/archive posture in one line: exact range serving of sealed media.
FROM debian:bookworm-slim
COPY bin/linux-x86_64/oham /usr/local/bin/oham
COPY web /srv/oham-web
COPY LICENSE LICENSE.apache2 LICENSE.commons-clause NOTICE /licenses/
EXPOSE 8207
ENTRYPOINT ["oham"]
CMD ["serve", "/srv/oham-web", "--port", "8207", "--bind", "0.0.0.0"]
