import { Box, DatePicker, Icon, Popover, TextField } from '@shopify/polaris';
import { CalendarIcon } from '@shopify/polaris-icons';
import { useEffect, useRef, useState } from 'react';
import { getTimezonedDateTime } from '../libs/helpers';

/**
 * @param currentValue the form state date string
 * @param initialDate a date string with YYYY-MM-DD format
 * @param label a string
 * @param minDate a date string with YYYY-MM-DD format | Default: Empty, means dates before today will be disbaled
 * @param onChange a callback function
 * 
 * @returns Returns a date string with YYYY-MM-DD format
 */
export default function DrDatePicker({ currentValue="", initialDate="", label="Date", minDate = "", timezoneOffsetMinutes, onChange=() => {} }) {
    const today = getTimezonedDateTime({timezoneOffset: timezoneOffsetMinutes, iso: false});

    const getDateString = (date) => {
        return getTimezonedDateTime({timezoneOffset: timezoneOffsetMinutes, dateString: date}).split('T')[0];
    };

    const isInitialMount = useRef(true);
    
    const [{month, year}, setDate] = useState({ month: today.getMonth(), year: today.getFullYear() });

    const [datePopoverActive, setDatePopoverActive] = useState(false);

    const [selectedDate, setSelectedDate] = useState(initialDate ? getTimezonedDateTime({timezoneOffset: timezoneOffsetMinutes, dateString: initialDate, iso: false}) : "");
    const [dateString, setDateString] = useState(initialDate ? getDateString(initialDate) : "");

    const [disableDatesBefore, setDisableDatesBefore] = useState(null);
    useEffect(() => {
        if(minDate) {
            if(minDate != "no-limit") {
                let minDateParsed = getTimezonedDateTime({timezoneOffset: timezoneOffsetMinutes, dateString: minDate, iso: false});
                minDateParsed.setDate(minDateParsed.getDate() - 1);
                setDisableDatesBefore(minDateParsed);
            }
        }
        else {
            let minDateParsed = today;
            minDateParsed.setDate(minDateParsed.getDate() - 1);
            setDisableDatesBefore(minDateParsed);
        }
    }, []);

    useEffect(() => {
        if (isInitialMount.current) {
        isInitialMount.current = false;
        }
        else if (selectedDate) {
            onChange(dateString);
        }
    }, [selectedDate]);

    useEffect(() => {
        setDateString(currentValue);
        setSelectedDate(new Date(currentValue));
    }, [currentValue]);
    
    const onDateChange = (v) => {
        const newDate = new Date(v.start);
        setSelectedDate(newDate);
        setDateString(getDateString(newDate));
        setDatePopoverActive(false);
    };

    const toggleDatePopoverActive = () => setDatePopoverActive(v => !v);

    const handleMonthChange = (month, year) => setDate({month, year});

    const dateActivator = (
        <TextField
            label={label}
            value={dateString}
            prefix={<Icon source={CalendarIcon} />}
            onFocus={toggleDatePopoverActive}
            autoComplete="off"
        />
    );

    return (
        <Popover
            preferredPosition="above"
            active={datePopoverActive}
            activator={dateActivator}
            onClose={toggleDatePopoverActive}
        >
            <Box padding={300}>
                <DatePicker
                    month={month}
                    year={year}
                    allowRange={false}
                    onChange={onDateChange}
                    onMonthChange={handleMonthChange}
                    selected={selectedDate}
                    disableDatesBefore={disableDatesBefore || null}
                />
            </Box>
        </Popover>
    )
}