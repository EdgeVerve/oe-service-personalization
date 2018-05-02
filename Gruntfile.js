/**
 *
 * ©2018-2019 EdgeVerve Systems Limited (a fully owned Infosys subsidiary),
 * Bangalore, India. All Rights Reserved.
 *
 */

module.exports = function GruntConfig(grunt) {
  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    mkdir: {
      all: {
        options: {
          create: ['dist']
        }
      }
    },

    copy: {
      main: {
        files: [
          // includes files within path and its sub-directories
          {
            expand: true,
            src: ['**', '!node_modules/**', '!coverage/**'],
            dest: 'dist/'
          }
        ]
      }
    },

    mochaTest: {
      test: {
        options: {
          quiet: false,
          clearRequireCache: true,
          timeout: 100000
        },
        src: ['server/test.js']
      }
    },

    clean: {
      coverage: {
        src: ['coverage/']
      },
      dist: {
        src: ['dist/']
      }
    },

    mocha_istanbul: {
      coverage: {
        src: 'test',
        options: {
          excludes: [],
          timeout: 60000,
          check: {
            lines: 78,
            statements: 78,
            branches: 65,
            functions: 84
          },
          reportFormats: ['lcov']
        }
      }
    }
  });

  // Add the grunt-mocha-test tasks.
  grunt.loadNpmTasks('grunt-mocha-test');
  grunt.loadNpmTasks('grunt-mocha-istanbul');
  grunt.loadNpmTasks('grunt-contrib-clean');

  grunt.loadNpmTasks('grunt-mkdir');
  grunt.loadNpmTasks('grunt-contrib-copy');

  grunt.registerTask('test-with-coverage', ['clean:coverage', 'mocha_istanbul']);
};
