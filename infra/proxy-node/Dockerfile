FROM gogost/gost:3.0.0-rc10

USER root
RUN apk add --no-cache ca-certificates openssl sh

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 8443 443

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
