/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { describe, expect, it } from '@jest/globals'
import minimist from 'minimist'
import { readFileSync, rmSync } from 'node:fs'
import { argv } from 'node:process'
import { tmpdir } from 'os'
import { join } from 'path'
import RerunService from '../src'
import { gherkinDocument, pickle } from './fixtures/cucumber'

describe('wdio-rerun-service', () => {
    const nonPassingItemsCucumber = [
        { location: 'feature/sample.feature:1', failure: 'some error' },
        { location: 'feature/sample.feature:4', failure: 'another error' },
    ]
    const nonPassingItemsMocha = [
        { location: 'tests/sample1.test.ts', failure: 'some error' },
        { location: 'tests/sample2.test.ts', failure: 'another error' },
    ]
    const capabilities = { browser: 'chrome' }
    const specFile = ['features/sample.feature']

    const world = {
        gherkinDocument: gherkinDocument,
        result: {
            status: 'PASSED' as any,
            duration: {
                seconds: 0,
                nanos: 1000000,
            },
        },
        pickle: pickle,
    }

    const cucumberBrowser = { config: { framework: 'cucumber' } }
    const mochaBrowser = { config: { framework: 'mocha' } }

    describe('setup', () => {
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
            expect(service.rerunDataDir).toEqual(
                './results/custom_rerun_directory',
            )
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
            const service = new RerunService({
                commandPrefix: 'CUSTOM_VAR=true',
            })
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
    })

    describe('before', () => {
        it('should throw an exception when no parameters are given', () => {
            const service = new RerunService()
            // @ts-expect-error - test invalid input
            expect(() => service.before()).toThrow()
        })

        it('should not throw an exception when empty specFile parameter', () => {
            const service = new RerunService()
            expect(() => service.before({}, [])).not.toThrow()
        })
    })

    describe('afterScenario', () => {
        it('should throw an exception when no parameters are given', () => {
            const service = new RerunService()
            // @ts-expect-error - test invalid input
            expect(() => service.afterScenario()).toThrow()
        })

        it('should not throw an exception when parameters are given', () => {
            const service = new RerunService()
            // @ts-expect-error - mock browser object
            global.browser = cucumberBrowser
            expect(() => service.afterScenario(world as any)).not.toThrow()
        })

        for (const status of ['PENDING', 'UNDEFINED', 'AMBIGUOUS', 'FAILED']) {
            it('should add to nonPassingItems if status is ' + status, () => {
                const service = new RerunService()
                // @ts-expect-error - mock browser object
                global.browser = cucumberBrowser
                const testWorld = { ...world, result: { status } }
                service.afterScenario(testWorld as any)
                expect(service.nonPassingItems.length).toBeGreaterThan(0)
            })
        }

        for (const status of ['PASSED', 'SKIPPED']) {
            it(
                'should not add to nonPassingItems if status is ' + status,
                () => {
                    const service = new RerunService()
                    // @ts-expect-error - mock browser object
                    global.browser = cucumberBrowser
                    const testWorld = { ...world, result: { status } }
                    service.afterScenario(testWorld as any)
                    expect(service.nonPassingItems).toEqual([])
                },
            )
        }

        it('should add to nonPassingItems if tag is not ignored', () => {
            const service = new RerunService({
                ignoredTags: ['@scenario-tag6'],
            })
            // @ts-expect-error - mock browser object
            global.browser = cucumberBrowser
            const testWorld = { ...world, result: { status: 'FAILED' } }
            service.afterScenario(testWorld as any)
            expect(service.nonPassingItems.length).toBeGreaterThan(0)
        })

        it('should not add to nonPassingItems if tag is ignored', () => {
            const service = new RerunService({
                ignoredTags: ['@scenario-tag1'],
            })
            // @ts-expect-error - mock browser object
            global.browser = cucumberBrowser
            const testWorld = { ...world, result: { status: 'FAILED' } }
            service.afterScenario(testWorld as any)
            expect(service.nonPassingItems).toEqual([])
        })
    })

    describe('afterTest', () => {
        it('should not throw an exception when parameters are given', () => {
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

        it('should not throw an exception when parameters are given but no error.message', () => {
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

        it('should add to nonPassingItems if results.passed is false', () => {
            const service = new RerunService()
            // @ts-expect-error - mock browser object
            global.browser = mochaBrowser
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
            })
            expect(service.nonPassingItems.length).toBeGreaterThan(0)
        })

        it('should not add to nonPassingItems if results.passed is true', () => {
            const service = new RerunService()
            // @ts-expect-error - mock browser object
            global.browser = mochaBrowser
            service.afterTest({} as any, 'context', {
                error: { message: 'This test has failed.' },
                result: 'result',
                duration: 24213,
                passed: true,
                retries: {
                    limit: 0,
                    attempts: 0,
                },
                exception: '',
                status: 'status',
            })
            expect(service.nonPassingItems).toEqual([])
        })
    })

    describe('after', () => {
        it('after should not throw an exception when no parameters are given', () => {
            const service = new RerunService()
            service.nonPassingItems = nonPassingItemsCucumber
            service.serviceWorkerId = '123'
            expect(() => service.before(capabilities, specFile)).not.toThrow()
            expect(() => service.after()).not.toThrow()
        })
    })

    describe('onComplete', () => {
        it('should throw an exception when no parameters are given with prefix', () => {
            const service = new RerunService({
                commandPrefix: 'CUSTOM_VAR=true',
            })
            service.nonPassingItems = nonPassingItemsCucumber
            expect(() => service.onComplete()).not.toThrow()
        })

        it('should throw an exception when no parameters are given with additional params', () => {
            const service = new RerunService({ customParameters: '--foobar' })
            service.nonPassingItems = nonPassingItemsMocha
            expect(() => service.onComplete()).not.toThrow()
        })

        it('should not throw an exception when no parameters are given and no nonPassingItems', () => {
            const service = new RerunService()
            service.serviceWorkerId = '123'
            expect(() => service.after()).not.toThrow()
        })

        it('should add failed specs to rerun script', () => {
            const rerunDataDir = join(tmpdir(), 'rerun-data')
            const rerunScriptPath = join(rerunDataDir, 'rerun.sh')
            const service = new RerunService({ rerunDataDir, rerunScriptPath })
            service.before({}, [])
            service.nonPassingItems = nonPassingItemsMocha
            service.after()
            service.onComplete()
            const rerunScript = readFileSync(rerunScriptPath, 'utf8')
            const parsedArgs = minimist(argv.slice(2))
            const args = parsedArgs._[0] ?? ''
            expect(rerunScript).toBe(
                `DISABLE_RERUN=true node_modules/.bin/wdio ${args} --spec=tests/sample1.test.ts --spec=tests/sample2.test.ts`,
            )
            rmSync(rerunDataDir, { recursive: true, force: true })
        })
    })
})
