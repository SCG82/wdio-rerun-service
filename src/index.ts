import type { Capabilities, Frameworks, Services } from '@wdio/types'
import type { Testrunner } from '@wdio/types/build/Options'
import minimist from 'minimist'
import {
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { v5 as uuidv5 } from 'uuid'

const argv = minimist(process.argv.slice(2))

type AfterScenario = NonNullable<
    WebdriverIO.HookFunctionExtension['afterScenario']
>
type AfterScenarioParameters = Parameters<AfterScenario>
type World = AfterScenarioParameters[0]

interface NonPassingItem {
    location: string
    failure?: string | undefined
}

interface RerunServiceOptions {
    ignoredTags?: string[]
    rerunDataDir?: string
    rerunScriptPath?: string
    commandPrefix?: string
    customParameters?: string
}

export default class RerunService implements Services.ServiceInstance {
    nonPassingItems: NonPassingItem[]
    serviceWorkerId: string
    ignoredTags: string[]
    rerunDataDir: string
    rerunScriptPath: string
    commandPrefix: string
    customParameters: string
    specFile: string

    constructor(options: RerunServiceOptions = {}) {
        const {
            ignoredTags,
            rerunDataDir,
            rerunScriptPath,
            commandPrefix,
            customParameters,
        } = options
        this.nonPassingItems = []
        this.serviceWorkerId = ''
        this.ignoredTags = ignoredTags ?? []
        this.rerunDataDir = rerunDataDir ?? './results/rerun'
        this.rerunScriptPath = rerunScriptPath ?? './rerun.sh'
        this.commandPrefix = commandPrefix ?? ''
        this.customParameters = customParameters ?? ''
        this.specFile = ''
    }

    before(_capabilities: Capabilities.RemoteCapability, specs: string[]) {
        this.specFile = specs[0]
        // console.log(`Re-run service is activated. Data directory: ${this.rerunDataDir}`);
        mkdirSync(this.rerunDataDir, { recursive: true })
        // INFO: `namespace` below copied from: https://github.com/kelektiv/node-uuid/blob/master//lib/v35.js#L54:16
        this.serviceWorkerId = uuidv5(
            `${Date.now()}`,
            '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        )
    }

    afterTest(
        _test: Frameworks.Test,
        _context: any,
        results: Frameworks.TestResult,
    ) {
        const { passed } = results
        const config = browser.config as Testrunner
        const error = results.error as Error | undefined
        if (config.framework !== 'cucumber' && !passed) {
            // console.log(`Re-run service is inspecting non-passing test.`);
            // console.log(`Test location: ${this.specFile}`);
            if (error?.message) {
                this.nonPassingItems.push({
                    location: this.specFile,
                    failure: error.message,
                })
            } else {
                // console.log("The non-passing test did not contain any error message, it could not be added for re-run.")
            }
        }
    }

    // Executed after a Cucumber scenario ends.
    afterScenario(world: World) {
        const CUCUMBER_STATUS_MAP = [
            'UNKNOWN',
            'PASSED',
            'SKIPPED',
            'PENDING',
            'UNDEFINED',
            'AMBIGUOUS',
            'FAILED',
        ]
        const config = browser.config as Testrunner
        const status =
            typeof world.result?.status === 'number'
                ? CUCUMBER_STATUS_MAP[world.result.status]
                : world.result?.status
        const scenarioLineNumber =
            world.gherkinDocument.feature?.children.filter((child) => {
                if (child.scenario) {
                    return world.pickle.astNodeIds.includes(
                        child.scenario.id.toString(),
                    )
                }
            })?.[0]?.scenario?.location.line
        if (
            config.framework === 'cucumber' &&
            status !== 'PASSED' &&
            status !== 'SKIPPED'
        ) {
            const scenarioLocation = `${world.pickle.uri}:${
                scenarioLineNumber ?? 0
            }`
            const tagsList = world.pickle.tags.map((tag) => tag.name)
            if (
                this.ignoredTags.length &&
                !tagsList.some((ignoredTag) =>
                    this.ignoredTags.includes(ignoredTag),
                )
            ) {
                this.nonPassingItems.push({
                    location: scenarioLocation,
                    failure: world.result?.message,
                })
            }
        }
    }

    after() {
        if (this.nonPassingItems.length > 0) {
            writeFileSync(
                `${this.rerunDataDir}/rerun-${this.serviceWorkerId}.json`,
                JSON.stringify(this.nonPassingItems),
            )
        } else {
            // console.log('Re-run service did not detect any non-passing scenarios or tests.');
        }
    }

    onComplete() {
        const directoryPath = path.join(process.cwd(), `${this.rerunDataDir}`)
        if (existsSync(directoryPath)) {
            const rerunFiles = readdirSync(directoryPath)
            if (rerunFiles.length > 0) {
                let rerunCommand = `${this.commandPrefix} DISABLE_RERUN=true node_modules/.bin/wdio ${argv._[0]} ${this.customParameters} `
                const failureLocations: string[] = []
                rerunFiles.forEach((file) => {
                    const json: NonPassingItem[] = JSON.parse(
                        readFileSync(`${this.rerunDataDir}/${file}`, 'utf8'),
                    )
                    json.forEach((failure) => {
                        failureLocations.push(
                            failure.location.replace(/\\/g, '/'),
                        )
                    })
                })
                const failureLocationsUnique = Array.from(
                    new Set(failureLocations),
                )
                failureLocationsUnique.forEach((failureLocation) => {
                    rerunCommand += ` --spec=${failureLocation}`
                })
                writeFileSync(this.rerunScriptPath, rerunCommand)
                // console.log(`Re-run script has been generated @ ${this.rerunScriptPath}`);
            }
        }
    }
}
