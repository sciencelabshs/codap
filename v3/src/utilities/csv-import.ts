import { parse, ParseResult } from "papaparse"
import { DataSet, toCanonical } from "../models/data/data-set"

type RowType = Record<string, string>
export type CsvParseResult = ParseResult<RowType>

export function importCsvFile(file: File | null, onComplete: (results: CsvParseResult, aFile: any) => void) {
  parse(file, { header: true, complete: onComplete })
}

export function downloadCsvFile(dataUrl: string, onComplete: (results: CsvParseResult, aFile: any) => void) {
  parse(dataUrl, { download: true, header: true, complete: onComplete })
}

export function convertParsedCsvToDataSet(results: CsvParseResult, filename: string) {
  const ds = DataSet.create({ name: filename })
  // add attributes (extracted from first case)
  for (const pName in results.data[0]) {
    ds.addAttribute({name: pName})
  }
  // add cases
  ds.addCases(toCanonical(ds, results.data))

  return ds
}
