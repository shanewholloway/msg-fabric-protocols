import pkg from './package.json'
import rpi_jsy from 'rollup-plugin-jsy-babel'

const sourcemap = 'inline'
const external = ['crypto']
const plugins = [rpi_jsy()]

export default {
	input: 'code/index.jsy',
  output: [
    { file: pkg.main, format: 'cjs', sourcemap, exports:'named' },
    { file: pkg.module, format: 'es', sourcemap },
  ],
  external, plugins }
