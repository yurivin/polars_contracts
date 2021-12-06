FROM node:12-alpine
LABEL maintainer="Sergey Sharshunov <s.sharshunov@gmail.com>"
# RUN rm -rf /var/cache/apk/* && \
#     mkdir /src/app
WORKDIR /src/app
COPY ["package.json", "./"]
RUN apk update && \
    apk upgrade && \
    apk --update add python py-pip git make g++ && \
    apk add --no-cache bash && \
    npm install --unsafe-perm -g truffle && \
    npm install -g mocha && \
    npm install -g solc && \
    npm install -g mocha-junit-reporter && \
    npm install && \
    rm -rf /var/cache/apk/*
CMD ["truffle"]
