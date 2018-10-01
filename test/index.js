'use strict';

const lab = exports.lab = require('lab').script();
const expect = require('code').expect;

const beforeEach = lab.beforeEach;
const describe = lab.describe;
const it = lab.it;
const { promisify } = require('util');

const timeout = promisify(setTimeout);

const Hapi = require('hapi');
const HapiRateLimit = require('../');

describe('hapi-rate-limit', () => {

    describe('defaults', () => {

        let server;

        beforeEach(async () => {

            server = Hapi.server({
                autoListen: false,
                cache: { engine: require('catbox-memory'), name: 'memory' }
            });

            server.auth.scheme('trusty', () => {

                return {
                    authenticate: function (request, h) {

                        return h.authenticated({ credentials: { id: request.query.id, name: request.query.name } });
                    }
                };
            });
            server.auth.strategy('trusty', 'trusty');

            await server.register(HapiRateLimit);

            server.route(require('./test-routes'));
            await server.initialize();
        });

        it('no route settings', async () => {

            let res;
            res = await server.inject({ method: 'GET', url: '/defaults' });

            expect(res.statusCode).to.equal(200);
            const pathReset = res.headers['x-ratelimit-pathreset'];
            const userReset = res.headers['x-ratelimit-userreset'];

            expect(res.headers).to.include([
                'x-ratelimit-pathlimit', 'x-ratelimit-pathremaining', 'x-ratelimit-pathreset',
                'x-ratelimit-userlimit', 'x-ratelimit-userremaining', 'x-ratelimit-userreset'
            ]);
            expect(res.headers).to.not.include(['x-ratelimit-userpathlimit-seconds', 'x-ratelimit-userpathremaining-seconds', 'x-ratelimit-userpathreset-seconds']);
            expect(res.headers).to.not.include(['x-ratelimit-userpathlimit-minutes', 'x-ratelimit-userpathremaining-minutes', 'x-ratelimit-userpathreset-minutes']);
            expect(res.headers).to.not.include(['x-ratelimit-userpathlimit-hours', 'x-ratelimit-userpathremaining-hours', 'x-ratelimit-userpathreset-hours']);
            expect(res.headers).to.not.include(['x-ratelimit-userpathlimit-days', 'x-ratelimit-userpathremaining-days', 'x-ratelimit-userpathreset-days']);
            expect(res.headers['x-ratelimit-pathlimit']).to.equal(50);
            expect(res.headers['x-ratelimit-pathremaining']).to.equal(49);
            expect(res.headers['x-ratelimit-pathreset']).to.be.a.number();
            expect(res.headers['x-ratelimit-pathreset'] - Date.now()).to.be.within(59900, 60100);
            expect(res.headers['x-ratelimit-userlimit']).to.equal(300);
            expect(res.headers['x-ratelimit-userremaining']).to.equal(299);
            expect(res.headers['x-ratelimit-userreset']).to.be.a.number();
            expect(res.headers['x-ratelimit-userreset'] - Date.now()).to.be.within(599900, 600100);

            res = await server.inject({ method: 'GET', url: '/defaults' });
            expect(res.headers).to.include([
                'x-ratelimit-pathlimit', 'x-ratelimit-pathremaining', 'x-ratelimit-pathreset',
                'x-ratelimit-userlimit', 'x-ratelimit-userremaining', 'x-ratelimit-userreset'
            ]);
            expect(res.headers).to.not.include(['x-ratelimit-userpathlimit-seconds', 'x-ratelimit-userpathremaining-seconds', 'x-ratelimit-userpathreset-seconds']);
            expect(res.headers).to.not.include(['x-ratelimit-userpathlimit-minutes', 'x-ratelimit-userpathremaining-minutes', 'x-ratelimit-userpathreset-minutes']);
            expect(res.headers).to.not.include(['x-ratelimit-userpathlimit-hours', 'x-ratelimit-userpathremaining-hours', 'x-ratelimit-userpathreset-hours']);
            expect(res.headers).to.not.include(['x-ratelimit-userpathlimit-days', 'x-ratelimit-userpathremaining-days', 'x-ratelimit-userpathreset-days']);
            expect(res.headers['x-ratelimit-pathlimit']).to.equal(50);
            expect(res.headers['x-ratelimit-pathremaining']).to.equal(48);
            expect(res.headers['x-ratelimit-pathreset'] - pathReset).to.be.within(-100, 100);
            expect(res.headers['x-ratelimit-userlimit']).to.equal(300);
            expect(res.headers['x-ratelimit-userremaining']).to.equal(298);
            expect(res.headers['x-ratelimit-userreset'] - userReset).to.be.within(-100, 100);
        });

        it('authenticated request', async () => {

            let res;

            res = await server.inject({ method: 'GET', url: '/auth?id=1' });
            expect(res.headers['x-ratelimit-userremaining']).to.equal(299);

            res = await server.inject({ method: 'GET', url: '/auth?id=1' });
            expect(res.headers['x-ratelimit-userremaining']).to.equal(298);

            res = await server.inject({ method: 'GET', url: '/auth?id=2' });
            expect(res.headers['x-ratelimit-userremaining']).to.equal(299);
        });

        it('route configured user attribute', async () => {

            let res;

            res = await server.inject({ method: 'GET', url: '/authName?id=1&name=foo' });
            expect(res.headers['x-ratelimit-userremaining']).to.equal(299);

            res = await server.inject({ method: 'GET', url: '/authName?id=1&name=foo' });
            expect(res.headers['x-ratelimit-userremaining']).to.equal(298);

            res = await server.inject({ method: 'GET', url: '/authName?id=1&name=bar' });
            expect(res.headers['x-ratelimit-userremaining']).to.equal(299);
        });

        it('route configured addressOnly', async () => {

            let res;
            res = await server.inject({ method: 'GET', url: '/addressOnly?id=3' });
            expect(res.headers['x-ratelimit-userremaining']).to.equal(299);

            res = await server.inject({ method: 'GET', url: '/addressOnly?id=3' });
            expect(res.headers['x-ratelimit-userremaining']).to.equal(298);
            res = await server.inject({ method: 'GET', url: '/addressOnly?id=4' });
            expect(res.headers['x-ratelimit-userremaining']).to.equal(297);
        });

        it('route configured addressOnly for userPathLimitMinutes', async () => {

            let res;
            res = await server.inject({ method: 'GET', url: '/addressOnlyUserPathLimit?id=3' });
            expect(res.headers['x-ratelimit-userpathremaining-minutes']).to.equal(49);

            res = await server.inject({ method: 'GET', url: '/addressOnlyUserPathLimit?id=3' });
            expect(res.headers['x-ratelimit-userpathremaining-minutes']).to.equal(48);

            res = await server.inject({ method: 'GET', url: '/addressOnlyUserPathLimit?id=4' });
            expect(res.headers['x-ratelimit-userpathremaining-minutes']).to.equal(47);
        });

        it('route configured addressOnly for userPathLimitSeconds', async () => {

            let res;
            res = await server.inject({ method: 'GET', url: '/addressOnlyUserPathLimit?id=3' });
            expect(res.headers['x-ratelimit-userpathremaining-seconds']).to.equal(49);

            res = await server.inject({ method: 'GET', url: '/addressOnlyUserPathLimit?id=3' });
            expect(res.headers['x-ratelimit-userpathremaining-seconds']).to.equal(48);

            res = await server.inject({ method: 'GET', url: '/addressOnlyUserPathLimit?id=4' });
            expect(res.headers['x-ratelimit-userpathremaining-seconds']).to.equal(47);
        });

        it('route configured addressOnly for userPathLimitHours', async () => {

            let res;
            res = await server.inject({ method: 'GET', url: '/addressOnlyUserPathLimit?id=3' });
            expect(res.headers['x-ratelimit-userpathremaining-hours']).to.equal(49);

            res = await server.inject({ method: 'GET', url: '/addressOnlyUserPathLimit?id=3' });
            expect(res.headers['x-ratelimit-userpathremaining-hours']).to.equal(48);

            res = await server.inject({ method: 'GET', url: '/addressOnlyUserPathLimit?id=4' });
            expect(res.headers['x-ratelimit-userpathremaining-hours']).to.equal(47);
        });

        it('route configured addressOnly for userPathLimitDays', async () => {

            let res;
            res = await server.inject({ method: 'GET', url: '/addressOnlyUserPathLimit?id=3' });
            expect(res.headers['x-ratelimit-userpathremaining-days']).to.equal(49);

            res = await server.inject({ method: 'GET', url: '/addressOnlyUserPathLimit?id=3' });
            expect(res.headers['x-ratelimit-userpathremaining-days']).to.equal(48);

            res = await server.inject({ method: 'GET', url: '/addressOnlyUserPathLimit?id=4' });
            expect(res.headers['x-ratelimit-userpathremaining-days']).to.equal(47);
        });

        it('route disabled pathLimit', async () => {

            const res = await server.inject({ method: 'GET', url: '/noPathLimit' });
            expect(res.headers).to.include(['x-ratelimit-userlimit', 'x-ratelimit-userremaining', 'x-ratelimit-userreset']);
            expect(res.headers).to.not.include(['x-ratelimit-pathlimit', 'x-ratelimit-pathremaining', 'x-ratelimit-pathreset']);
        });

        it('route disabled userLimit', async () => {

            const res = await server.inject({ method: 'GET', url: '/noUserLimit' });
            expect(res.headers).to.include(['x-ratelimit-pathlimit', 'x-ratelimit-pathremaining', 'x-ratelimit-pathreset']);
            expect(res.headers).to.not.include(['x-ratelimit-userlimit', 'x-ratelimit-userremaining', 'x-ratelimit-userreset']);
        });

        it('route disabled userPathLimitSeconds', async () => {

            const res = await server.inject({ method: 'GET', url: '/noUserPathLimit' });
            expect(res.headers).to.include(['x-ratelimit-pathlimit', 'x-ratelimit-pathremaining', 'x-ratelimit-pathreset']);
            expect(res.headers).to.include(['x-ratelimit-userlimit', 'x-ratelimit-userremaining', 'x-ratelimit-userreset']);
            expect(res.headers).to.not.include(['x-ratelimit-userpathlimit-seconds', 'x-ratelimit-userpathremaining-seconds', 'x-ratelimit-userpathreset-seconds']);
        });

        it('route disabled userPathLimitMinutes', async () => {

            const res = await server.inject({ method: 'GET', url: '/noUserPathLimit' });
            expect(res.headers).to.include(['x-ratelimit-pathlimit', 'x-ratelimit-pathremaining', 'x-ratelimit-pathreset']);
            expect(res.headers).to.include(['x-ratelimit-userlimit', 'x-ratelimit-userremaining', 'x-ratelimit-userreset']);
            expect(res.headers).to.not.include(['x-ratelimit-userpathlimit-minutes', 'x-ratelimit-userpathremaining-minutes', 'x-ratelimit-userpathreset-minutes']);
        });

        it('route disabled userPathLimitHours', async () => {

            const res = await server.inject({ method: 'GET', url: '/noUserPathLimit' });
            expect(res.headers).to.include(['x-ratelimit-pathlimit', 'x-ratelimit-pathremaining', 'x-ratelimit-pathreset']);
            expect(res.headers).to.include(['x-ratelimit-userlimit', 'x-ratelimit-userremaining', 'x-ratelimit-userreset']);
            expect(res.headers).to.not.include(['x-ratelimit-userpathlimit-hours', 'x-ratelimit-userpathremaining-hours', 'x-ratelimit-userpathreset-hours']);
        });

        it('route disabled userPathLimitDays', async () => {

            const res = await server.inject({ method: 'GET', url: '/noUserPathLimit' });
            expect(res.headers).to.include(['x-ratelimit-pathlimit', 'x-ratelimit-pathremaining', 'x-ratelimit-pathreset']);
            expect(res.headers).to.include(['x-ratelimit-userlimit', 'x-ratelimit-userremaining', 'x-ratelimit-userreset']);
            expect(res.headers).to.not.include(['x-ratelimit-userpathlimit-days', 'x-ratelimit-userpathremaining-days', 'x-ratelimit-userpathreset-days']);
        });

        it('route configured pathLimit', async () => {

            let res;
            res = await server.inject({ method: 'GET', url: '/setPathLimit' });
            const pathReset = res.headers['x-ratelimit-pathreset'];
            expect(res.headers).to.include([
                'x-ratelimit-pathlimit', 'x-ratelimit-pathremaining', 'x-ratelimit-pathreset',
                'x-ratelimit-userlimit', 'x-ratelimit-userremaining', 'x-ratelimit-userreset'
            ]);
            expect(res.headers['x-ratelimit-pathlimit']).to.equal(50);
            expect(res.headers['x-ratelimit-pathremaining']).to.equal(49);
            expect(res.headers['x-ratelimit-pathreset']).to.be.a.number();
            expect(res.headers['x-ratelimit-pathreset'] - Date.now()).to.be.within(59900, 60100);

            res = await server.inject({ method: 'GET', url: '/setPathLimit' });
            expect(res.headers).to.include([
                'x-ratelimit-pathlimit', 'x-ratelimit-pathremaining', 'x-ratelimit-pathreset',
                'x-ratelimit-userlimit', 'x-ratelimit-userremaining', 'x-ratelimit-userreset'
            ]);
            expect(res.headers['x-ratelimit-pathlimit']).to.equal(50);
            expect(res.headers['x-ratelimit-pathremaining']).to.equal(48);
            expect(res.headers['x-ratelimit-pathreset'] - pathReset).to.be.within(-100, 100);
        });

        it('runs out of pathLimit', async () => {

            let res;
            res = await server.inject({ method: 'GET', url: '/lowPathLimit' });
            expect(res.headers['x-ratelimit-pathremaining']).to.equal(1);

            res = await server.inject({ method: 'GET', url: '/lowPathLimit' });
            expect(res.headers['x-ratelimit-pathremaining']).to.equal(0);

            res = await server.inject({ method: 'GET', url: '/lowPathLimit' });
            expect(res.statusCode).to.equal(429);
        });

        it('route configured userPathLimitMinutes', async () => {

            let res;
            res = await server.inject({ method: 'GET', url: '/setUserPathLimit?id=1' });
            const userPathReset = res.headers['x-ratelimit-userpathreset-minutes'];
            expect(res.headers).to.include([
                'x-ratelimit-pathlimit', 'x-ratelimit-pathremaining', 'x-ratelimit-pathreset',
                'x-ratelimit-userlimit', 'x-ratelimit-userremaining', 'x-ratelimit-userreset',
                'x-ratelimit-userpathlimit-minutes', 'x-ratelimit-userpathremaining-minutes', 'x-ratelimit-userpathreset-minutes'
            ]);
            expect(res.headers['x-ratelimit-userpathlimit-minutes']).to.equal(50);
            expect(res.headers['x-ratelimit-userpathremaining-minutes']).to.equal(49);
            expect(res.headers['x-ratelimit-userpathreset-minutes']).to.be.a.number();
            expect(res.headers['x-ratelimit-userpathreset-minutes'] - Date.now()).to.be.within(59900, 60100);

            res = await server.inject({ method: 'GET', url: '/setUserPathLimit2?id=1' });
            expect(res.headers).to.include([
                'x-ratelimit-pathlimit', 'x-ratelimit-pathremaining', 'x-ratelimit-pathreset',
                'x-ratelimit-userlimit', 'x-ratelimit-userremaining', 'x-ratelimit-userreset',
                'x-ratelimit-userpathlimit-minutes', 'x-ratelimit-userpathremaining-minutes', 'x-ratelimit-userpathreset-minutes'
            ]);
            expect(res.headers['x-ratelimit-userpathlimit-minutes']).to.equal(50);
            expect(res.headers['x-ratelimit-userpathremaining-minutes']).to.equal(49);
            expect(res.headers['x-ratelimit-userpathreset-minutes']).to.be.a.number();
            expect(res.headers['x-ratelimit-userpathreset-minutes'] - Date.now()).to.be.within(59900, 60100);

            res = await server.inject({ method: 'GET', url: '/setUserPathLimit?id=1' });
            expect(res.headers).to.include([
                'x-ratelimit-pathlimit', 'x-ratelimit-pathremaining', 'x-ratelimit-pathreset',
                'x-ratelimit-userlimit', 'x-ratelimit-userremaining', 'x-ratelimit-userreset',
                'x-ratelimit-userpathlimit-minutes', 'x-ratelimit-userpathremaining-minutes', 'x-ratelimit-userpathreset-minutes'
            ]);
            expect(res.headers['x-ratelimit-userpathlimit-minutes']).to.equal(50);
            expect(res.headers['x-ratelimit-userpathremaining-minutes']).to.equal(48);
            expect(res.headers['x-ratelimit-userpathreset-minutes'] - userPathReset).to.be.within(-100, 100);
        });

        it('route configured userPathLimitSeconds', async () => {

            let res;
            res = await server.inject({ method: 'GET', url: '/setUserPathLimit?id=1' });
            const userPathReset = res.headers['x-ratelimit-userpathreset-seconds'];
            expect(res.headers).to.include([
                'x-ratelimit-pathlimit', 'x-ratelimit-pathremaining', 'x-ratelimit-pathreset',
                'x-ratelimit-userlimit', 'x-ratelimit-userremaining', 'x-ratelimit-userreset',
                'x-ratelimit-userpathlimit-seconds', 'x-ratelimit-userpathremaining-seconds', 'x-ratelimit-userpathreset-seconds'
            ]);
            expect(res.headers['x-ratelimit-userpathlimit-seconds']).to.equal(50);
            expect(res.headers['x-ratelimit-userpathremaining-seconds']).to.equal(49);
            expect(res.headers['x-ratelimit-userpathreset-seconds']).to.be.a.number();
            expect(res.headers['x-ratelimit-userpathreset-seconds'] - Date.now()).to.be.within(900, 1100);

            res = await server.inject({ method: 'GET', url: '/setUserPathLimit2?id=1' });
            expect(res.headers).to.include([
                'x-ratelimit-pathlimit', 'x-ratelimit-pathremaining', 'x-ratelimit-pathreset',
                'x-ratelimit-userlimit', 'x-ratelimit-userremaining', 'x-ratelimit-userreset',
                'x-ratelimit-userpathlimit-seconds', 'x-ratelimit-userpathremaining-seconds', 'x-ratelimit-userpathreset-seconds'
            ]);
            expect(res.headers['x-ratelimit-userpathlimit-seconds']).to.equal(50);
            expect(res.headers['x-ratelimit-userpathremaining-seconds']).to.equal(49);
            expect(res.headers['x-ratelimit-userpathreset-seconds']).to.be.a.number();
            expect(res.headers['x-ratelimit-userpathreset-seconds'] - Date.now()).to.be.within(900, 1100);

            res = await server.inject({ method: 'GET', url: '/setUserPathLimit?id=1' });
            expect(res.headers).to.include([
                'x-ratelimit-pathlimit', 'x-ratelimit-pathremaining', 'x-ratelimit-pathreset',
                'x-ratelimit-userlimit', 'x-ratelimit-userremaining', 'x-ratelimit-userreset',
                'x-ratelimit-userpathlimit-seconds', 'x-ratelimit-userpathremaining-seconds', 'x-ratelimit-userpathreset-seconds'
            ]);
            expect(res.headers['x-ratelimit-userpathlimit-seconds']).to.equal(50);
            expect(res.headers['x-ratelimit-userpathremaining-seconds']).to.equal(48);
            expect(res.headers['x-ratelimit-userpathreset-seconds'] - userPathReset).to.be.within(-100, 100);
        });

        it('route configured userPathLimitHours', async () => {

            let res;
            res = await server.inject({ method: 'GET', url: '/setUserPathLimit?id=1' });
            const userPathReset = res.headers['x-ratelimit-userpathreset-hours'];
            expect(res.headers).to.include([
                'x-ratelimit-pathlimit', 'x-ratelimit-pathremaining', 'x-ratelimit-pathreset',
                'x-ratelimit-userlimit', 'x-ratelimit-userremaining', 'x-ratelimit-userreset',
                'x-ratelimit-userpathlimit-hours', 'x-ratelimit-userpathremaining-hours', 'x-ratelimit-userpathreset-hours'
            ]);
            expect(res.headers['x-ratelimit-userpathlimit-hours']).to.equal(50);
            expect(res.headers['x-ratelimit-userpathremaining-hours']).to.equal(49);
            expect(res.headers['x-ratelimit-userpathreset-hours']).to.be.a.number();
            expect(res.headers['x-ratelimit-userpathreset-hours'] - Date.now()).to.be.within(3599900, 3610000);

            res = await server.inject({ method: 'GET', url: '/setUserPathLimit2?id=1' });
            expect(res.headers).to.include([
                'x-ratelimit-pathlimit', 'x-ratelimit-pathremaining', 'x-ratelimit-pathreset',
                'x-ratelimit-userlimit', 'x-ratelimit-userremaining', 'x-ratelimit-userreset',
                'x-ratelimit-userpathlimit-hours', 'x-ratelimit-userpathremaining-hours', 'x-ratelimit-userpathreset-hours'
            ]);
            expect(res.headers['x-ratelimit-userpathlimit-hours']).to.equal(50);
            expect(res.headers['x-ratelimit-userpathremaining-hours']).to.equal(49);
            expect(res.headers['x-ratelimit-userpathreset-hours']).to.be.a.number();
            expect(res.headers['x-ratelimit-userpathreset-hours'] - Date.now()).to.be.within(3599900, 3610000);

            res = await server.inject({ method: 'GET', url: '/setUserPathLimit?id=1' });
            expect(res.headers).to.include([
                'x-ratelimit-pathlimit', 'x-ratelimit-pathremaining', 'x-ratelimit-pathreset',
                'x-ratelimit-userlimit', 'x-ratelimit-userremaining', 'x-ratelimit-userreset',
                'x-ratelimit-userpathlimit-hours', 'x-ratelimit-userpathremaining-hours', 'x-ratelimit-userpathreset-hours'
            ]);
            expect(res.headers['x-ratelimit-userpathlimit-hours']).to.equal(50);
            expect(res.headers['x-ratelimit-userpathremaining-hours']).to.equal(48);
            expect(res.headers['x-ratelimit-userpathreset-hours'] - userPathReset).to.be.within(-100, 100);
        });

        it('route configured userPathLimitDays', async () => {

            let res;
            res = await server.inject({ method: 'GET', url: '/setUserPathLimit?id=1' });
            const userPathReset = res.headers['x-ratelimit-userpathreset-days'];
            expect(res.headers).to.include([
                'x-ratelimit-pathlimit', 'x-ratelimit-pathremaining', 'x-ratelimit-pathreset',
                'x-ratelimit-userlimit', 'x-ratelimit-userremaining', 'x-ratelimit-userreset',
                'x-ratelimit-userpathlimit-days', 'x-ratelimit-userpathremaining-days', 'x-ratelimit-userpathreset-days'
            ]);
            expect(res.headers['x-ratelimit-userpathlimit-days']).to.equal(50);
            expect(res.headers['x-ratelimit-userpathremaining-days']).to.equal(49);
            expect(res.headers['x-ratelimit-userpathreset-days']).to.be.a.number();
            expect(res.headers['x-ratelimit-userpathreset-days'] - Date.now()).to.be.within(86399900, 87400000);

            res = await server.inject({ method: 'GET', url: '/setUserPathLimit2?id=1' });
            expect(res.headers).to.include([
                'x-ratelimit-pathlimit', 'x-ratelimit-pathremaining', 'x-ratelimit-pathreset',
                'x-ratelimit-userlimit', 'x-ratelimit-userremaining', 'x-ratelimit-userreset',
                'x-ratelimit-userpathlimit-days', 'x-ratelimit-userpathremaining-days', 'x-ratelimit-userpathreset-days'
            ]);
            expect(res.headers['x-ratelimit-userpathlimit-days']).to.equal(50);
            expect(res.headers['x-ratelimit-userpathremaining-days']).to.equal(49);
            expect(res.headers['x-ratelimit-userpathreset-days']).to.be.a.number();
            expect(res.headers['x-ratelimit-userpathreset-days'] - Date.now()).to.be.within(86399900, 87400000);

            res = await server.inject({ method: 'GET', url: '/setUserPathLimit?id=1' });
            expect(res.headers).to.include([
                'x-ratelimit-pathlimit', 'x-ratelimit-pathremaining', 'x-ratelimit-pathreset',
                'x-ratelimit-userlimit', 'x-ratelimit-userremaining', 'x-ratelimit-userreset',
                'x-ratelimit-userpathlimit-days', 'x-ratelimit-userpathremaining-days', 'x-ratelimit-userpathreset-days'
            ]);
            expect(res.headers['x-ratelimit-userpathlimit-days']).to.equal(50);
            expect(res.headers['x-ratelimit-userpathremaining-days']).to.equal(48);
            expect(res.headers['x-ratelimit-userpathreset-days'] - userPathReset).to.be.within(-100, 100);
        });

        it('runs out of userPathLimitMinutes', async () => {

            let res;
            res = await server.inject({ method: 'GET', url: '/lowUserPathLimit' });
            expect(res.headers['x-ratelimit-userpathremaining-minutes']).to.equal(1);

            res = await server.inject({ method: 'GET', url: '/lowUserPathLimit' });
            expect(res.headers['x-ratelimit-userpathremaining-minutes']).to.equal(0);

            res = await server.inject({ method: 'GET', url: '/lowUserPathLimit' });
            expect(res.statusCode).to.equal(429);
        });

        it('runs out of userPathLimitSeconds', async () => {

            let res;
            res = await server.inject({ method: 'GET', url: '/lowUserPathLimit' });
            expect(res.headers['x-ratelimit-userpathremaining-seconds']).to.equal(1);

            res = await server.inject({ method: 'GET', url: '/lowUserPathLimit' });
            expect(res.headers['x-ratelimit-userpathremaining-seconds']).to.equal(0);

            res = await server.inject({ method: 'GET', url: '/lowUserPathLimit' });
            expect(res.statusCode).to.equal(429);
        });

        it('runs out of userPathLimitHours', async () => {

            let res;
            res = await server.inject({ method: 'GET', url: '/lowUserPathLimit' });
            expect(res.headers['x-ratelimit-userpathremaining-hours']).to.equal(1);

            res = await server.inject({ method: 'GET', url: '/lowUserPathLimit' });
            expect(res.headers['x-ratelimit-userpathremaining-hours']).to.equal(0);

            res = await server.inject({ method: 'GET', url: '/lowUserPathLimit' });
            expect(res.statusCode).to.equal(429);
        });

        it('runs out of userPathLimitDays', async () => {

            let res;
            res = await server.inject({ method: 'GET', url: '/lowUserPathLimit' });
            expect(res.headers['x-ratelimit-userpathremaining-days']).to.equal(1);

            res = await server.inject({ method: 'GET', url: '/lowUserPathLimit' });
            expect(res.headers['x-ratelimit-userpathremaining-days']).to.equal(0);

            res = await server.inject({ method: 'GET', url: '/lowUserPathLimit' });
            expect(res.statusCode).to.equal(429);
        });

        it('route configured no headers', async () => {

            const res = await server.inject({ method: 'GET', url: '/noHeaders' });
            expect(res.headers).to.not.include([
                'x-ratelimit-pathlimit', 'x-ratelimit-pathremaining', 'x-ratelimit-pathreset',
                'x-ratelimit-userlimit', 'x-ratelimit-userremaining', 'x-ratelimit-userreset',
                'x-ratelimit-userpathlimit-seconds', 'x-ratelimit-userpathremaining-seconds', 'x-ratelimit-userpathreset-seconds',
                'x-ratelimit-userpathlimit-minutes', 'x-ratelimit-userpathremaining-minutes', 'x-ratelimit-userpathreset-minutes',
                'x-ratelimit-userpathlimit-hours', 'x-ratelimit-userpathremaining-hours', 'x-ratelimit-userpathreset-hours',
                'x-ratelimit-userpathlimit-days', 'x-ratelimit-userpathremaining-days', 'x-ratelimit-userpathreset-days'
            ]);
        });

        it('404 reply from handler', async () => {

            let res;
            res = await server.inject({ method: 'GET', url: '/notfound' });
            expect(res.statusCode).to.equal(404);
            expect(res.headers).to.include([
                'x-ratelimit-userlimit', 'x-ratelimit-userremaining', 'x-ratelimit-userreset'
            ]);
            expect(res.headers).to.not.include([
                'x-ratelimit-pathlimit', 'x-ratelimit-pathremaining', 'x-ratelimit-pathreset',
                'x-ratelimit-userpathlimit-seconds', 'x-ratelimit-userpathremaining-seconds', 'x-ratelimit-userpathreset-seconds',
                'x-ratelimit-userpathlimit-minutes', 'x-ratelimit-userpathremaining-minutes', 'x-ratelimit-userpathreset-minutes',
                'x-ratelimit-userpathlimit-hours', 'x-ratelimit-userpathremaining-hours', 'x-ratelimit-userpathreset-hours',
                'x-ratelimit-userpathlimit-days', 'x-ratelimit-userpathremaining-days', 'x-ratelimit-userpathreset-days'
            ]);

            const userCount = res.headers['x-ratelimit-userremaining'];

            res = await server.inject({ method: 'GET', url: '/notfound' });
            expect(userCount - res.headers['x-ratelimit-userremaining']).to.equal(1);
        });

        it('404 reply from internal hapi catchall', async () => {

            const res = await server.inject({ method: 'GET', url: '/notinroutingtable' });
            expect(res.statusCode).to.equal(404);
            expect(res.headers).to.not.include([
                'x-ratelimit-userlimit', 'x-ratelimit-userremaining', 'x-ratelimit-userreset'
            ]);
            expect(res.headers).to.not.include([
                'x-ratelimit-pathlimit', 'x-ratelimit-pathremaining', 'x-ratelimit-pathreset',
                'x-ratelimit-userpathlimit-seconds', 'x-ratelimit-userpathremaining-seconds', 'x-ratelimit-userpathreset-seconds',
                'x-ratelimit-userpathlimit-minutes', 'x-ratelimit-userpathremaining-minutes', 'x-ratelimit-userpathreset-minutes',
                'x-ratelimit-userpathlimit-hours', 'x-ratelimit-userpathremaining-hours', 'x-ratelimit-userpathreset-hours',
                'x-ratelimit-userpathlimit-days', 'x-ratelimit-userpathremaining-days', 'x-ratelimit-userpathreset-days'
            ]);
        });

        it('route configured trustProxy', async () => {

            let res;
            res = await server.inject({ method: 'GET', url: '/trustProxy', headers: { 'x-forwarded-for': '127.0.0.2, 127.0.0.1' } });
            expect(res.headers['x-ratelimit-userremaining']).to.equal(299);

            res = await server.inject({ method: 'GET', url: '/trustProxy', headers: { 'x-forwarded-for': '127.0.0.2, 127.0.0.1' } });
            expect(res.headers['x-ratelimit-userremaining']).to.equal(298);

            res = await server.inject({ method: 'GET', url: '/trustProxy' });
            expect(res.headers['x-ratelimit-userremaining']).to.equal(299);
        });

        it('route configured ipWhitelist', async () => {

            const res = await server.inject({ method: 'GET', url: '/ipWhitelist', headers: { 'x-forwarded-for': '127.0.0.2, 127.0.0.1' } });
            expect(res.headers).to.include(['x-ratelimit-pathlimit', 'x-ratelimit-pathremaining', 'x-ratelimit-pathreset']);
            expect(res.headers).to.not.include(['x-ratelimit-userlimit', 'x-ratelimit-userremaining', 'x-ratelimit-userreset']);
        });

        it('route configured userWhitelist', async () => {

            let res;
            res = await server.inject({ method: 'GET', url: '/userWhitelist?id=1' });
            expect(res.headers).to.include(['x-ratelimit-pathlimit', 'x-ratelimit-pathremaining', 'x-ratelimit-pathreset']);
            expect(res.headers).to.not.include(['x-ratelimit-userlimit', 'x-ratelimit-userremaining', 'x-ratelimit-userreset']);

            res = await server.inject({ method: 'GET', url: '/userWhitelist?id=2' });
            expect(res.headers).to.include([
                'x-ratelimit-pathlimit', 'x-ratelimit-pathremaining', 'x-ratelimit-pathreset',
                'x-ratelimit-userlimit', 'x-ratelimit-userremaining', 'x-ratelimit-userreset'
            ]);
            expect(res.headers['x-ratelimit-userremaining']).to.equal(299);
        });

    });

    describe('configured user limit', () => {

        let server;

        beforeEach(async () => {

            server = Hapi.server({
                autoListen: false,
                cache: { engine: require('catbox-memory') }
            });

            server.events.on({ name: 'request', channels: ['error'] }, (request, event) => {

                console.log(event.error);
            });

            server.auth.scheme('trusty', () => {

                return {
                    authenticate: function (request, h) {

                        return h.authenticated({ credentials: { id: request.query.id, name: request.query.name } });
                    }
                };
            });

            server.auth.strategy('trusty', 'trusty');

            await server.register([{
                plugin: HapiRateLimit,
                options: {
                    userLimit: 2,
                    userCache: {
                        expiresIn: 500
                    }
                }
            }]);
            server.route(require('./test-routes'));
            await server.initialize();
        });

        it('runs out of configured userLimit', async () => {

            let res;
            res = await server.inject({ method: 'GET', url: '/defaults' });
            expect(res.headers['x-ratelimit-userremaining']).to.equal(1);
            expect(res.headers['x-ratelimit-userlimit']).to.equal(2);

            res = await server.inject({ method: 'GET', url: '/defaults' });
            expect(res.headers['x-ratelimit-userremaining']).to.equal(0);

            res = await server.inject({ method: 'GET', url: '/defaults' });
            expect(res.statusCode).to.equal(429);
            await timeout(1000);
            res = await server.inject({ method: 'GET', url: '/defaults' });
            expect(res.headers['x-ratelimit-userremaining']).to.equal(1);
            expect(res.headers['x-ratelimit-userlimit']).to.equal(2);
        });

        it('disabled path limit runs out of userLimit', async () => {

            await server.inject({ method: 'GET', url: '/noPathLimit' });
            await server.inject({ method: 'GET', url: '/noPathLimit' });
            const res = await server.inject({ method: 'GET', url: '/noPathLimit' });
            expect(res.statusCode).to.equal(429);
            expect(res.headers).to.not.include(['x-ratelimit-pathlimit', 'x-ratelimit-pathremaining', 'x-ratelimit-pathreset']);
        });

    });

    describe('disabled routes', () => {

        let server;

        beforeEach(async () => {

            server = Hapi.server({
                autoListen: false,
                cache: { engine: require('catbox-memory') }
            });

            server.auth.scheme('trusty', () => {

                return {
                    authenticate: function (request, h) {

                        return h.authenticated({ credentials: { id: request.query.id, name: request.query.name } });
                    }
                };
            });

            server.auth.strategy('trusty', 'trusty');

            await server.register([{
                plugin: HapiRateLimit,
                options: {
                    userLimit: 1,
                    pathLimit: 1,
                    userCache: {
                        expiresIn: 500
                    }
                }
            }]);
            server.route(require('./test-routes'));
            await server.initialize();
        });

        it('route disabled', async () => {

            const res = await server.inject({ method: 'GET', url: '/pathDisabled' });

            expect(res.headers).to.not.include(['x-ratelimit-pathlimit', 'x-ratelimit-pathremaining', 'x-ratelimit-pathreset']);
            expect(res.headers).to.not.include(['x-ratelimit-userlimit', 'x-ratelimit-userremaining', 'x-ratelimit-userreset']);
        });
    });

    describe('configured user limit with numeric id', () => {

        let server;

        beforeEach(async () => {

            server = Hapi.server({
                autoListen: false,
                cache: { engine: require('catbox-memory') }
            });

            server.auth.scheme('trusty', () => {

                return {
                    authenticate: function (request, h) {

                        return h.authenticated({ credentials: { id: 10 } });
                    }
                };
            });

            server.auth.strategy('trusty', 'trusty');

            await server.register([{
                plugin: HapiRateLimit,
                options: {
                    userLimit: 2,
                    userCache: {
                        expiresIn: 500
                    },
                    userPathLimitMinutes: 2,
                    userPathCacheMinutes: {
                        expiresIn: 500
                    }
                }
            }]);
            server.route(require('./test-routes'));
            await server.initialize();
        });

        it('runs out of configured userLimit', async () => {

            let res;
            res = await server.inject({ method: 'GET', url: '/auth' });
            expect(res.headers['x-ratelimit-userremaining']).to.equal(1);
            expect(res.headers['x-ratelimit-userlimit']).to.equal(2);

            res = await server.inject({ method: 'GET', url: '/auth' });
            expect(res.headers['x-ratelimit-userremaining']).to.equal(0);

            res = await server.inject({ method: 'GET', url: '/auth' });
            expect(res.statusCode).to.equal(429);
            await timeout(1000);
            res = await server.inject({ method: 'GET', url: '/auth' });

            expect(res.headers['x-ratelimit-userremaining']).to.equal(1);
            expect(res.headers['x-ratelimit-userlimit']).to.equal(2);
        });

        it('runs out of configured userPathLimitMinutes', async () => {

            let res;
            res = await server.inject({ method: 'GET', url: '/auth' });
            expect(res.headers['x-ratelimit-userpathremaining-minutes']).to.equal(1);
            expect(res.headers['x-ratelimit-userpathlimit-minutes']).to.equal(2);

            res = await server.inject({ method: 'GET', url: '/auth' });
            expect(res.headers['x-ratelimit-userpathremaining-minutes']).to.equal(0);

            res = await server.inject({ method: 'GET', url: '/auth' });
            expect(res.statusCode).to.equal(429);
            await timeout(1000);
            res = await server.inject({ method: 'GET', url: '/auth' });

            expect(res.headers['x-ratelimit-userpathremaining-minutes']).to.equal(1);
            expect(res.headers['x-ratelimit-userpathlimit-minutes']).to.equal(2);
        });

        it('disabled path limit runs out of userLimit', async () => {

            await server.inject({ method: 'GET', url: '/noPathLimit' });
            await server.inject({ method: 'GET', url: '/noPathLimit' });
            const res = await server.inject({ method: 'GET', url: '/noPathLimit' });

            expect(res.statusCode).to.equal(429);
            expect(res.headers).to.not.include(['x-ratelimit-pathlimit', 'x-ratelimit-pathremaining', 'x-ratelimit-pathreset']);
        });

    });

    describe('custom get ip from proxy header which returns the last one', () => {

        let server;

        beforeEach(async () => {

            server = Hapi.server({
                autoListen: false,
                cache: { engine: require('catbox-memory') }
            });

            server.auth.scheme('trusty', () => {

                return {
                    authenticate: function (request, h) {

                        return h.authenticated({ credentials: { id: request.query.id, name: request.query.name } });
                    }
                };
            });
            server.auth.strategy('trusty', 'trusty');

            await server.register([{
                plugin: HapiRateLimit,
                options: {
                    getIpFromProxyHeader: (xForwardedFor) => xForwardedFor.split(',')[1] // Take always the second one
                }
            }]);
            server.route(require('./test-routes'));
            await server.initialize();
        });

        it('increases the user remaining only when the last ip in the x-forwarded-for header changes', async () => {

            let res;
            res = await server.inject({ method: 'GET', url: '/trustProxy', headers: { 'x-forwarded-for': '127.0.0.2, 127.0.0.1' } });
            expect(res.headers['x-ratelimit-userremaining']).to.equal(299);

            res = await server.inject({ method: 'GET', url: '/trustProxy', headers: { 'x-forwarded-for': '127.0.0.2, 127.0.0.3' } });
            expect(res.headers['x-ratelimit-userremaining']).to.equal(299);
        });


    });
});
