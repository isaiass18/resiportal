Title: Live Content

Description: Fetched live

Source: https://raw.githubusercontent.com/shuchkin/simplexlsx/master/src/SimpleXLSX.php

---

<?php /** @noinspection MultiAssignmentUsageInspection */

namespace Shuchkin;

use SimpleXMLElement;

/**
 *    SimpleXLSX php class
 *    MS Excel 2007+ workbooks reader
 *
 * Copyright (c) 2012 - 2022 SimpleXLSX
 *
 * @category   SimpleXLSX
 * @package    SimpleXLSX
 * @copyright  Copyright (c) 2012 - 2022 SimpleXLSX (https://github.com/shuchkin/simplexlsx/)
 * @license    MIT
 */

/** Examples
 *
 * use Shuchkin\SimpleXLSX;
 *
 * Example 1:
 * if ( $xlsx = SimpleXLSX::parse('book.xlsx') ) {
 *   foreach ($xlsx->rows() as $r) {
 *     print_r( $r );
 *   }
 * } else {
 *   echo SimpleXLSX::parseError();
 * }
 *
 * Example 2: html table
 * if ( $xlsx = SimpleXLSX::parse('book.xlsx') ) {
 *   echo $xlsx->toHTML();
 * } else {
 *   echo SimpleXLSX::parseError();
 * }
 *
 * Example 3: rowsEx
 * $xlsx = SimpleXLSX::parse('book.xlsx');
 * foreach ( $xlsx->rowsEx() as $r ) {
 *   print_r( $r );
 * }
 *
 * Example 4: select worksheet
 * $xlsx = SimpleXLSX::parse('book.xlsx');
 * foreach( $xlsx->rows(1) as $r  ) { // second worksheet
 *   print_t( $r );
 * }
 *
 * Example 5: IDs and worksheet names
 * $xlsx = SimpleXLSX::parse('book.xlsx');
 * print_r( $xlsx->sheetNames() ); // array( 0 => 'Sheet 1', 1 => 'Catalog' );
 *
 * Example 6: get sheet name by index
 * $xlsx = SimpleXLSX::parse('book.xlsx');
 * echo 'Sheet Name 2 = '.$xlsx->sheetName(1);
 *
 * Example 7: getCell (very slow)
 * echo $xlsx->getCell(1,'D12'); // reads D12 cell from second sheet
 *
 * Example 8: read data
 * if ( $xlsx = SimpleXLSX::parseData( file_get_contents('http://www.example.com/example.xlsx') ) ) {
 *   $dim = $xlsx->dimension(1);
 *   $num_cols = $dim[0];
 *   $num_rows = $dim[1];
 *   echo $xlsx->sheetName(1).':'.$num_cols.'x'.$num_rows;
 * } else {
 *   echo SimpleXLSX::parseError();
 * }
 *
 * Example 9: old style
 * $xlsx = new SimpleXLSX('book.xlsx');
 * if ( $xlsx->success() ) {
 *   print_r( $xlsx->rows() );
 * } else {
 *   echo 'xlsx error: '.$xlsx->error();
 * }
 */
class SimpleXLSX
{
    // Don't remove this string! Created by Sergey Shuchkin sergey.shuchkin@gmail.com
    public static $CF = [ // Cell formats
        0 => 'General',
        1 => '0',
        2 => '0.00',
        3 => '#,##0',
        4 => '#,##0.00',
        9 => '0%',
        10 => '0.00%',
        11 => '0.00E+00',
        12 => '# ?/?',
        13 => '# ??/??',
        14 => 'mm-dd-yy',
        15 => 'd-mmm-yy',
        16 => 'd-mmm',
        17 => 'mmm-yy',
        18 => 'h:mm AM/PM',
        19 => 'h:mm:ss AM/PM',
        20 => 'h:mm',
        21 => 'h:mm:ss',
        22 => 'm/d/yy h:mm',

        37 => '#,##0 ;(#,##0)',
        38 => '#,##0 ;[Red](#,##0)',
        39 => '#,##0.00;(#,##0.00)',
        40 => '#,##0.00;[Red](#,##0.00)',

        44 => '_("$"* #,##0.00_);_("$"* \(#,##0.00\);_("$"* "-"??_);_(@_)',
        45 => 'mm:ss',
        46 => '[h]:mm:ss',
        47 => 'mmss.0',
        48 => '##0.0E+0',
        49 => '@',

        27 => '[$-404]e/m/d',
        30 => 'm/d/yy',
        36 => '[$-404]e/m/d',
        50 => '[$-404]e/m/d',
        57 => '[$-404]e/m/d',

        59 => 't0',
        60 => 't0.00',
        61 => 't#,##0',
        62 => 't#,##0.00',
        67 => 't0%',
        68 => 't0.00%',
        69 => 't# ?/?',
        70 => 't# ??/??',
    ];
    public $nf = []; // number formats
    public $cellFormats = []; // cellXfs
    public $datetimeFormat = 'Y-m-d H:i:s';
    public $debug;
    public $activeSheet = 0;
    public $rowsExReader;

    /* @var SimpleXMLElement[] $sheets */
    public $sheets;
    public $sheetFiles = [];
    public $sheetMetaData = [];
    public $sheetRels = [];
    // scheme
    public $styles;
    /* @var array[] $package */
    public $package;
    public $sharedstrings;
    public $date1904 = 0;


    /*
        private $date_formats = array(
            0xe => "d/m/Y",
            0xf => "d-M-Y",
            0x10 => "d-M",
            0x11 => "M-Y",
            0x12 => "h:i a",
            0x13 => "h:i:s a",
            0x14 => "H:i",
            0x15 => "H:i:s",
            0x16 => "d/m/Y H:i",
            0x2d => "i:s",
            0x2e => "H:i:s",
            0x2f => "i:s.S"
        );
        private $number_formats = array(
            0x1 => "%1.0f",     // "0"
            0x2 => "%1.2f",     // "0.00",
            0x3 => "%1.0f",     //"#,##0",
            0x4 => "%1.2f",     //"#,##0.00",
            0x5 => "%1.0f",     //"$#,##0;($#,##0)",
            0x6 => '$%1.0f',    //"$#,##0;($#,##0)",
            0x7 => '$%1.2f',    //"$#,##0.00;($#,##0.00)",
            0x8 => '$%1.2f',    //"$#,##0.00;($#,##0.00)",
            0x9 => '%1.0f%%',   //"0%"
            0xa => '%1.2f%%',   //"0.00%"
            0xb => '%1.2f',     //"0.00E00",
            0x25 => '%1.0f',    //"#,##0;(#,##0)",
            0x26 => '%1.0f',    //"#,##0;(#,##0)",
            0x27 => '%1.2f',    //"#,##0.00;(#,##0.00)",
            0x28 => '%1.2f',    //"#,##0.00;(#,##0.00)",
            0x29 => '%1.0f',    //"#,##0;(#,##0)",
            0x2a => '$%1.0f',   //"$#,##0;($#,##0)",
            0x2b => '%1.2f',    //"#,##0.00;(#,##0.00)",
            0x2c => '$%1.2f',   //"$#,##0.00;($#,##0.00)",
            0x30 => '%1.0f');   //"##0.0E0";
        // }}}
    */
    public $errno = 0;
    public $error = false;
    /**
     * @var false|SimpleXMLElement
     */
    public $theme;


    public function __construct($filename = null, $is_data = null, $debug = null)
    {
        if ($debug !== null) {
            $this->debug = $debug;
        }
        $this->package = [
            'filename' => '',
            'mtime' => 0,
            'size' => 0,
            'comment' => '',
            'entries' => []
        ];
        if ($filename && $this->unzip($filename, $is_data)) {
            $this->parseEntries();
        }
    }

    public function unzip($filename, $is_data = false)
    {

        if ($is_data) {
            $this->package['filename'] = 'default.xlsx';
            $this->package['mtime'] = time();
            $this->package['size'] = self::strlen($filename);

            $vZ = $filename;
        } else {
            if (!is_readable($filename)) {
                $this->error(1, 'File not found ' . $filename);

                return false;
            }

            // Package information
            $this->package['filename'] = $filename;
            $this->package['mtime'] = filemtime($filename);
            $this->package['size'] = filesize($filename);

            // Read file
            $vZ = file_get_contents($filename);
        }
        // Cut end of central directory
        /*      $aE = explode("\x50\x4b\x05\x06", $vZ);

                if (count($aE) == 1) {
                    $this->error('Unknown format');
                    return false;
                }
        */
        // Explode to each part
        $aE = explode("\x50\x4b\x03\x04", $vZ);
        array_shift($aE);

        $aEL = count($aE);
        if ($aEL === 0) {
            $this->error(2, 'Unknown archive format');

            return false;
        }
        // Search central directory end record
        $last = $aE[$aEL - 1];
        $last = explode("\x50\x4b\x05\x06", $last);
        if (count($last) !== 2) {
            $this->error(2, 'Unknown archive format');

            return false;
        }
        // Search central directory
        $last = explode("\x50\x4b\x01\x02", $last[0]);
        if (count($last) < 2) {
            $this->error(2, 'Unknown archive format');

            return false;
        }
        $aE[$aEL - 1] = $last[0];

        // Loop through the entries
        foreach ($aE as $vZ) {
            $aI = [];
            $aI['E'] = 0;
            $aI['EM'] = '';
            // Retrieving local file header information
//          $aP = unpack('v1VN/v1GPF/v1CM/v1FT/v1FD/V1CRC/V1CS/V1UCS/v1FNL', $vZ);
            $aP = unpack('v1VN/v1GPF/v1CM/v1FT/v1FD/V1CRC/V1CS/V1UCS/v1FNL/v1EFL', $vZ);

            // Check if data is encrypted
//          $bE = ($aP['GPF'] && 0x0001) ? TRUE : FALSE;
//          $bE = false;
            $nF = $aP['FNL'];
            $mF = $aP['EFL'];

            // Special case : value block after the compressed data
            if ($aP['GPF'] & 0x0008) {
                $aP1 = unpack('V1CRC/V1CS/V1UCS', self::substr($vZ, -12));

                $aP['CRC'] = $aP1['CRC'];
                $aP['CS'] = $aP1['CS'];
                $aP['UCS'] = $aP1['UCS'];
                // 2013-08-10
                $vZ = self::substr($vZ, 0, -12);
                if (self::substr($vZ, -4) === "\x50\x4b\x07\x08") {
                    $vZ = self::substr($vZ, 0, -4);
                }
            }

            // Getting stored filename
            $aI['N'] = self::substr($vZ, 26, $nF);
            $aI['N'] = str_replace('\\', '/', $aI['N']);

            if (self::substr($aI['N'], -1) === '/') {
                // is a directory entry - will be skipped
                continue;
            }

            // Truncate full filename in

