/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { describe, expect, it } from '@jest/globals'
import RerunService from '../src'

describe('wdio-rerurn-service', () => {
    const nonPassingItems = [
        { name: '1', location: 'feature/sample.feature:1' },
        { name: '2', location: 'feature/sample.feature:4' },
    ]
    const capabilities = { browser: 'chrome' }
    const specFile = ['featurs/sample.feature']

    const world = {
        gherkinDocument: {
            feature: {
                children: [
                    {
                        background: {
                            id: 0,
                            location: { line: 1 },
                        },
                    },
                    {
                        scenario: {
                            id: 1,
                            location: { line: 3 },
                        },
                    },
                ],
            },
        },
        result: {
            status: 0,
        },
        pickle: {
            astNodeIds: ['1'],
            tags: ['@sample'],
        },
    }

    const cucumberBrowser = { config: { framework: 'cucumber' } }
    const mochaBrowser = { config: { framework: 'mocha' } }

    it('should not throw error when setup with no parameters', () => {
        const service = new RerunService()
        expect(() => service.before(capabilities, specFile)).not.toThrow()
        expect(service.ignoredTags).toEqual([])
        expect(service.rerunDataDir).toEqual('./results/rerun')
        expect(service.rerunScriptPath).toEqual('./rerun.sh')
        expect(service.commandPrefix).toEqual('')
        expect(service.customParameters).toEqual('')
    })

    it('should throw error when setup bad rereunDataDir', () => {
        const service = new RerunService({ rerunDataDir: '\0' })
        expect(() => service.before(capabilities, specFile)).toThrow()
    })

    it('can configure ignoredTags', () => {
        const service = new RerunService({ ignoredTags: ['@ignored'] })
        expect(() =>
            service.before({}, ['features/sample.feature']),
        ).not.toThrow()
        expect(service.ignoredTags).toEqual(['@ignored'])
        expect(service.rerunDataDir).toEqual('./results/rerun')
        expect(service.rerunScriptPath).toEqual('./rerun.sh')
        expect(service.commandPrefix).toEqual('')
        expect(service.customParameters).toEqual('')
    })

    it('can configure rerunDataDir', () => {
        const service = new RerunService({
            rerunDataDir: './results/custom_rerun_directory',
        })
        expect(() =>
            service.before({}, ['features/sample.feature']),
        ).not.toThrow()
        expect(service.ignoredTags).toEqual([])
        expect(service.rerunDataDir).toEqual('./results/custom_rerun_directory')
        expect(service.rerunScriptPath).toEqual('./rerun.sh')
        expect(service.commandPrefix).toEqual('')
        expect(service.customParameters).toEqual('')
    })

    it('can configure rerunScriptPath', () => {
        const service = new RerunService({
            rerunScriptPath: './custom_rerun_script.sh',
        })
        expect(() =>
            service.before({}, ['features/sample.feature']),
        ).not.toThrow()
        expect(service.ignoredTags).toEqual([])
        expect(service.rerunDataDir).toEqual('./results/rerun')
        expect(service.rerunScriptPath).toEqual('./custom_rerun_script.sh')
        expect(service.commandPrefix).toEqual('')
        expect(service.customParameters).toEqual('')
    })

    it('can configure commandPrefix', () => {
        const service = new RerunService({ commandPrefix: 'CUSTOM_VAR=true' })
        expect(() =>
            service.before({}, ['features/sample.feature']),
        ).not.toThrow()
        expect(service.ignoredTags).toEqual([])
        expect(service.rerunDataDir).toEqual('./results/rerun')
        expect(service.rerunScriptPath).toEqual('./rerun.sh')
        expect(service.commandPrefix).toEqual('CUSTOM_VAR=true')
        expect(service.customParameters).toEqual('')
    })

    it('can configure customParameters', () => {
        const service = new RerunService({ customParameters: '--foobar' })
        expect(() =>
            service.before({}, ['features/sample.feature']),
        ).not.toThrow()
        expect(service.ignoredTags).toEqual([])
        expect(service.rerunDataDir).toEqual('./results/rerun')
        expect(service.rerunScriptPath).toEqual('./rerun.sh')
        expect(service.commandPrefix).toEqual('')
        expect(service.customParameters).toEqual('--foobar')
    })

    it('before should throw an exception when no parameters are given', () => {
        const service = new RerunService()
        // @ts-expect-error - test invalid input
        expect(() => service.before()).toThrow()
    })

    it('afterTest should not throw an exception when parameters are given', () => {
        const service = new RerunService()
        // @ts-expect-error - mock browser object
        global.browser = mochaBrowser
        expect(() =>
            service.afterTest({} as any, 'context', {
                error: { message: 'This test has failed.' },
                result: 'result',
                duration: 24213,
                passed: false,
                retries: {
                    limit: 0,
                    attempts: 0,
                },
                exception: '',
                status: 'status',
            }),
        ).not.toThrow()
    })

    it('afterTest should not throw an exception when parameters are given but no error.message', () => {
        const service = new RerunService()
        // @ts-expect-error - mock browser object
        global.browser = mochaBrowser
        expect(() =>
            service.afterTest({} as any, 'context', {
                error: {},
                result: 'result',
                duration: 24213,
                passed: false,
                retries: {
                    limit: 0,
                    attempts: 0,
                },
                exception: '',
                status: 'status',
            }),
        ).not.toThrow()
    })

    it('afterScenario should throw an exception when no parameters are given', () => {
        const service = new RerunService()
        // @ts-expect-error - test invalid input
        expect(() => service.afterScenario()).toThrow()
    })

    it('afterScenario should not throw an exception when parameters are given', () => {
        const service = new RerunService()
        // @ts-expect-error - mock browser object
        global.browser = cucumberBrowser
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        expect(() => service.afterScenario(world as any)).not.toThrow()
    })

    it('after should not throw an exception when no parameters are given', () => {
        const service = new RerunService()
        service.nonPassingItems = nonPassingItems
        service.serviceWorkerId = '123'
        expect(() => service.before(capabilities, specFile)).not.toThrow()
        expect(() => service.after()).not.toThrow()
    })

    it('onComplete should throw an exception when no parameters are given with prefix', () => {
        const service = new RerunService({ commandPrefix: 'CUSTOM_VAR=true' })
        service.nonPassingItems = nonPassingItems
        expect(() => service.onComplete()).not.toThrow()
    })

    it('onComplete should throw an exception when no parameters are given with additional params', () => {
        const service = new RerunService({ customParameters: '--foobar' })
        service.nonPassingItems = nonPassingItems
        expect(() => service.onComplete()).not.toThrow()
    })

    it('onComplete should not throw an exception when no parameters are given and no nonPassingItems', () => {
        const service = new RerunService()
        service.serviceWorkerId = '123'
        expect(() => service.after()).not.toThrow()
    })

    it('before should not throw an exception when empty specFile parameter', () => {
        const service = new RerunService()
        expect(() => service.before({}, [])).not.toThrow()
    })
})
