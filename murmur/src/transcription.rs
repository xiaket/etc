//! Transcript merging with overlap detection.

const MIN_OVERLAP: usize = 10; // Minimum number of bytes to consider as overlap
const MAX_OVERLAP: usize = 300; // Maximum number of bytes to check for overlap

/// Merge transcripts, removing duplicated text where consecutive chunks overlap
pub fn merge_transcripts(transcripts: Vec<String>) -> String {
    let mut iter = transcripts.into_iter().filter(|t| !t.is_empty());
    let Some(mut result) = iter.next() else {
        return String::new();
    };

    for current in iter {
        let overlap = find_overlap_size(&result, &current);
        if overlap == 0 {
            result.push(' ');
        }
        result.push_str(&current[overlap..]);
    }

    result.trim().to_string()
}

fn find_overlap_size(previous: &str, current: &str) -> usize {
    let max_check = MAX_OVERLAP.min(current.len()).min(previous.len());

    // Check for different overlap sizes, from larger to smaller
    (MIN_OVERLAP..=max_check)
        .rev()
        .find(|&size| current.is_char_boundary(size) && previous.ends_with(&current[..size]))
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_merge_transcripts_empty() {
        assert_eq!(merge_transcripts(vec![]), String::new());
    }

    #[test]
    fn test_merge_transcripts_single() {
        assert_eq!(
            merge_transcripts(vec!["Hello world".to_string()]),
            "Hello world"
        );
    }

    #[test]
    fn test_merge_transcripts_no_overlap() {
        let transcripts = vec!["Hello".to_string(), "world".to_string()];
        assert_eq!(merge_transcripts(transcripts), "Hello world");
    }

    #[test]
    fn test_merge_transcripts_with_overlap() {
        let transcripts = vec!["Hello world".to_string(), "world and universe".to_string()];
        assert_eq!(
            merge_transcripts(transcripts),
            "Hello world world and universe"
        );
    }

    #[test]
    fn test_merge_transcripts_with_space_overlap() {
        let transcripts = vec!["Hello world ".to_string(), "world and universe".to_string()];
        assert_eq!(
            merge_transcripts(transcripts),
            "Hello world  world and universe"
        );
    }

    #[test]
    fn test_merge_transcripts_short_strings() {
        let transcripts = vec!["Hi".to_string(), "there".to_string()];
        assert_eq!(merge_transcripts(transcripts), "Hi there");
    }

    #[test]
    fn test_merge_transcripts_identical() {
        let transcripts = vec!["Same text here".to_string(), "Same text here".to_string()];
        assert_eq!(merge_transcripts(transcripts), "Same text here");
    }

    #[test]
    fn test_merge_transcripts_with_empty() {
        let transcripts = vec![
            "Hello world".to_string(),
            "".to_string(),
            "goodbye".to_string(),
        ];
        assert_eq!(merge_transcripts(transcripts), "Hello world goodbye");
    }

    #[test]
    fn test_merge_transcripts_large_overlap() {
        let long_text = "This is a very long sentence that should be detected as overlap when it appears at the end of one transcript and the beginning of another";
        let transcripts = vec![
            format!("Start of first transcript. {}", long_text),
            format!("{} End of second transcript.", long_text),
        ];
        assert_eq!(
            merge_transcripts(transcripts),
            format!(
                "Start of first transcript. {} End of second transcript.",
                long_text
            )
        );
    }

    #[test]
    fn test_merge_transcripts_multibyte_overlap() {
        // Overlap boundaries must never split a multi-byte character
        let transcripts = vec![
            "第一段结束重叠的部分".to_string(),
            "重叠的部分第二段开始".to_string(),
        ];
        assert_eq!(
            merge_transcripts(transcripts),
            "第一段结束重叠的部分第二段开始"
        );
    }

    #[test]
    fn test_merge_transcripts_multibyte_no_overlap() {
        let transcripts = vec!["今天天气很好".to_string(), "我们去公园散步".to_string()];
        assert_eq!(
            merge_transcripts(transcripts),
            "今天天气很好 我们去公园散步"
        );
    }

    #[test]
    fn test_find_overlap_size() {
        // Exact overlap (longer than minimum)
        assert_eq!(
            find_overlap_size("Hello world test", "world test and universe"),
            10 // "world test"
        );

        // No overlap
        assert_eq!(find_overlap_size("Hello", "there"), 0);

        // Below minimum overlap threshold
        assert_eq!(find_overlap_size("Hi", "i there"), 0);
        assert_eq!(find_overlap_size("Hello world", "world test"), 0);
    }
}
