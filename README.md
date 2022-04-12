<a href='https://ko-fi.com/baasbase' target='_blank'><img height='35' style='border:0px;height:46px;' src='https://az743702.vo.msecnd.net/cdn/kofi3.png?v=0' border='0' alt='Buy Me a Coffee at ko-fi.com'></a>

# twitch-eventsub-proxy

Twitch EventSub Proxy is what the name suggests. You start an SSL server which listens to Twitch EventSub messages, and it then uses websockets to forward the messages to any local application that wishes to connect to the server.

## Installation

- Run ``npm install``
- Create an SSL certificate, you need `cert.pem`, `chain.pem`, `privkey.pem`
- Change the `.env` file and add all the necessary data

## How to use

Run ``npm start``

Now you can connect to the websocket server using the port you specified in `.env`

## Credits

This is made by baasbase  
https://twitch.tv/baasbase  
https://twitter.com/baasbase  
https://www.youtube.com/channel/UCd5RjtL4EJwoeLJWiofGG3Q  
https://ko-fi.com/baasbase
